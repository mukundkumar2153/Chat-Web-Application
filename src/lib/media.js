import { supabase } from './supabase'
import { encryptFile, decryptFile } from './crypto'

const MAX_IMAGE_DIMENSION = 1600
const IMAGE_QUALITY = 0.82

export const ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  video: ['mp4', 'webm', 'mov'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'csv'],
  voice: ['webm', 'ogg', 'mp3', 'wav'],
}
export const MAX_FILE_SIZE_MB = 25

export function getExtension(filename) {
  return (filename.split('.').pop() || '').toLowerCase()
}

export function detectMessageType(file) {
  const ext = getExtension(file.name)
  if (ALLOWED_EXTENSIONS.image.includes(ext) || file.type.startsWith('image/')) return 'image'
  if (ALLOWED_EXTENSIONS.video.includes(ext) || file.type.startsWith('video/')) return 'video'
  if (ALLOWED_EXTENSIONS.voice.includes(ext) && file.type.startsWith('audio/')) return 'voice'
  return 'document'
}

export function validateFile(file) {
  const ext = getExtension(file.name)
  const allAllowed = [
    ...ALLOWED_EXTENSIONS.image, ...ALLOWED_EXTENSIONS.video,
    ...ALLOWED_EXTENSIONS.document, ...ALLOWED_EXTENSIONS.voice,
  ]
  if (!allAllowed.includes(ext)) {
    return { valid: false, error: `File type ".${ext}" is not allowed` }
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File too large (max ${MAX_FILE_SIZE_MB}MB)` }
  }
  return { valid: true }
}

/** Client-side compress an image File before encrypting/uploading. Returns a File. */
export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const img = await loadImage(file)
    let { width, height } = img
    if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && file.size < 600 * 1024) {
      return file
    }
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height))
    width = Math.round(width * scale)
    height = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file // fall back to original on any decode error
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Generate a small JPEG thumbnail (data URL) for image/video files, used for instant chat-list / bubble preview while full file decrypts. */
export async function generateThumbnail(file, type) {
  try {
    if (type === 'image') {
      const img = await loadImage(file)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 240 / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.6)
    }
    if (type === 'video') {
      return await videoThumbnail(file)
    }
  } catch {
    return null
  }
  return null
}

function videoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)
    video.muted = true
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 240 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = video.videoWidth * scale
      canvas.height = video.videoHeight * scale
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
      URL.revokeObjectURL(video.src)
    }
    video.onerror = () => resolve(null)
  })
}

/**
 * Encrypt + upload a file to the private chat-media bucket.
 * Returns metadata to store on the message row (no plaintext leaves the device).
 */
export async function encryptAndUploadFile({ file, conversationId, conversationKeyBytes, onProgress }) {
  const messageType = detectMessageType(file)
  const thumbnail = await generateThumbnail(file, messageType)
  const compressed = messageType === 'image' ? await compressImage(file) : file
  const { blob: encryptedBlob, nonce } = await encryptFile(compressed, conversationKeyBytes)

  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.enc`
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, encryptedBlob, { contentType: 'application/octet-stream' })
  if (error) throw error

  onProgress?.(100)

  return {
    storage_path: path,
    file_nonce: nonce,
    file_name: file.name,
    file_size: compressed.size,
    mime_type: compressed.type || file.type,
    thumbnail_data_url: thumbnail,
    message_type: messageType,
  }
}

/** Download + decrypt a file given message metadata. Returns an object URL string. */
export async function downloadAndDecryptFile({ storagePath, fileNonce, mimeType, conversationKeyBytes }) {
  const { data, error } = await supabase.storage.from('chat-media').download(storagePath)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  const blob = await decryptFile(arrayBuffer, fileNonce, conversationKeyBytes, mimeType)
  if (!blob) throw new Error('Failed to decrypt — wrong key or corrupted file')
  return URL.createObjectURL(blob)
}

export function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
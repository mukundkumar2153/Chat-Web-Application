// =============================================================
// WaveChat E2EE core
// -------------------------------------------------------------
// Design (kept deliberately simple & auditable, NOT full Signal/
// Double Ratchet — see README "Encryption" section for the honest
// tradeoffs):
//
// 1. Every user has a long-term X25519 keypair (nacl.box).
//    - Public key  -> stored in profiles.public_key (server can see it, that's fine)
//    - Private key -> NEVER leaves the device. Stored only in
//      localStorage on the device that generated it.
//
// 2. Every conversation (1:1 or group) has ONE random symmetric
//    secret key (nacl.secretbox, 32 bytes).
//    - That secret is "wrapped" (encrypted) individually for each
//      member using nacl.box(memberPublicKey, creatorPrivateKey).
//    - Wrapped copies live in conversation_keys. The server only
//      ever sees ciphertext blobs it cannot open.
//    - Each member unwraps their copy once with their own private
//      key, then uses the resulting symmetric key to encrypt/decrypt
//      every message + file in that conversation (fast, no per-message
//      asymmetric crypto needed).
//
// 3. Message text and file bytes are encrypted with nacl.secretbox
//    using that conversation key + a fresh random nonce per item.
//
// Honest limitations vs WhatsApp/Signal:
//    - No forward secrecy / ratcheting (one static key per conversation).
//    - Key isn't rotated automatically when group membership changes.
//    - If a user loses their private key (clears storage / new device
//      without migration), old messages become unreadable on that device.
// =============================================================

import nacl from 'tweetnacl'
import {
  encodeBase64, decodeBase64,
  encodeUTF8, decodeUTF8,
} from 'tweetnacl-util'

const PRIVATE_KEY_STORAGE_PREFIX = 'wavechat_sk_'

// ---------- Long-term identity keypair ----------

export function generateIdentityKeyPair() {
  const kp = nacl.box.keyPair()
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  }
}

export function storePrivateKey(userId, secretKeyBase64) {
  localStorage.setItem(PRIVATE_KEY_STORAGE_PREFIX + userId, secretKeyBase64)
}

export function getPrivateKey(userId) {
  return localStorage.getItem(PRIVATE_KEY_STORAGE_PREFIX + userId)
}

export function hasPrivateKey(userId) {
  return !!getPrivateKey(userId)
}

export function clearPrivateKey(userId) {
  localStorage.removeItem(PRIVATE_KEY_STORAGE_PREFIX + userId)
}

// A short human-readable fingerprint of a public key (for "verify identity" UI)
export function fingerprint(publicKeyBase64) {
  if (!publicKeyBase64) return ''
  const bytes = decodeBase64(publicKeyBase64)
  const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex.match(/.{1,4}/g).join(' ').toUpperCase()
}

// ---------- Conversation symmetric key ----------

export function generateConversationKey() {
  return nacl.randomBytes(nacl.secretbox.keyLength) // Uint8Array(32)
}

// Wrap (encrypt) a conversation key for one recipient using box (asymmetric)
export function wrapKeyForMember({ conversationKeyBytes, recipientPublicKeyBase64, mySecretKeyBase64 }) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const recipientPub = decodeBase64(recipientPublicKeyBase64)
  const mySecret = decodeBase64(mySecretKeyBase64)
  const encrypted = nacl.box(conversationKeyBytes, nonce, recipientPub, mySecret)
  return {
    encrypted_key: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  }
}

// Unwrap a conversation key that was wrapped for me
export function unwrapKeyForMe({ encryptedKeyBase64, nonceBase64, senderPublicKeyBase64, mySecretKeyBase64 }) {
  const encrypted = decodeBase64(encryptedKeyBase64)
  const nonce = decodeBase64(nonceBase64)
  const senderPub = decodeBase64(senderPublicKeyBase64)
  const mySecret = decodeBase64(mySecretKeyBase64)
  const opened = nacl.box.open(encrypted, nonce, senderPub, mySecret)
  if (!opened) return null
  return opened // Uint8Array(32) — the raw conversation key
}

// ---------- Symmetric encrypt/decrypt (messages + files) ----------

export function encryptText(plainText, conversationKeyBytes) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const messageUint8 = decodeUTF8(plainText)
  const box = nacl.secretbox(messageUint8, nonce, conversationKeyBytes)
  return {
    ciphertext: encodeBase64(box),
    nonce: encodeBase64(nonce),
  }
}

export function decryptText(ciphertextBase64, nonceBase64, conversationKeyBytes) {
  try {
    const box = decodeBase64(ciphertextBase64)
    const nonce = decodeBase64(nonceBase64)
    const opened = nacl.secretbox.open(box, nonce, conversationKeyBytes)
    if (!opened) return null
    return encodeUTF8(opened)
  } catch {
    return null
  }
}

// Encrypt raw file bytes (ArrayBuffer) -> Blob you can upload
export async function encryptFile(file, conversationKeyBytes) {
  const buffer = await file.arrayBuffer()
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const box = nacl.secretbox(new Uint8Array(buffer), nonce, conversationKeyBytes)
  const blob = new Blob([box], { type: 'application/octet-stream' })
  return { blob, nonce: encodeBase64(nonce) }
}

// Decrypt a downloaded encrypted blob back into a usable Blob with original mime type
export async function decryptFile(encryptedArrayBuffer, nonceBase64, conversationKeyBytes, originalMimeType) {
  const nonce = decodeBase64(nonceBase64)
  const opened = nacl.secretbox.open(new Uint8Array(encryptedArrayBuffer), nonce, conversationKeyBytes)
  if (!opened) return null
  return new Blob([opened], { type: originalMimeType || 'application/octet-stream' })
}

// ---------- Key cache (in-memory, per tab session) ----------
// conversationId -> Uint8Array(32)
const keyCache = new Map()

export function cacheConversationKey(conversationId, keyBytes) {
  keyCache.set(conversationId, keyBytes)
}
export function getCachedConversationKey(conversationId) {
  return keyCache.get(conversationId) || null
}
export function clearKeyCache() {
  keyCache.clear()
}
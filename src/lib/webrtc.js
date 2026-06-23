// WebRTC helper utilities for WaveChat voice/video calls
// Uses Supabase Realtime as signaling channel

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

/**
 * Create a new RTCPeerConnection with default ICE config
 */
export function createPeerConnection() {
  return new RTCPeerConnection(ICE_SERVERS)
}

/**
 * Get local media stream (audio + optional video)
 */
export async function getLocalStream({ video = false, audio = true } = {}) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video })
    return { stream, error: null }
  } catch (err) {
    return { stream: null, error: err.message || 'Media access denied' }
  }
}

/**
 * Add all tracks from a local stream to a peer connection
 */
export function addTracksToConnection(pc, localStream) {
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream)
  })
}

/**
 * Stop all tracks in a media stream and clean up
 */
export function stopStream(stream) {
  if (!stream) return
  stream.getTracks().forEach(track => track.stop())
}

/**
 * Build a signaling channel name for a conversation
 */
export function signalingChannel(conversationId) {
  return `call:${conversationId}`
}

/**
 * Signal types used over Supabase Realtime broadcast
 */
export const SIGNAL = {
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE: 'ice-candidate',
  HANGUP: 'hangup',
  RING: 'ring',
  REJECT: 'reject',
  BUSY: 'busy',
}
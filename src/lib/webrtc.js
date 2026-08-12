// WebRTC helper utilities for WaveChat voice/video calls
// Uses Supabase Realtime as signaling channel

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Free public TURN servers (OpenRelay) — enables calls across mobile data / NAT
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
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
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: video
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { stream, error: null }
  } catch (err) {
    return { stream: null, error: err.message || 'Media access denied' }
  }
}

/**
 * Get screen sharing stream
 */
export async function getDisplayMediaStream() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    })
    return { stream, error: null }
  } catch (err) {
    return { stream: null, error: err.message || 'Screen share denied' }
  }
}

/**
 * Replace video track in a PeerConnection (for screen share / camera swap)
 * Returns the old track so caller can restore it later
 */
export function replaceVideoTrack(pc, newTrack) {
  const senders = pc.getSenders()
  const videoSender = senders.find(s => s.track?.kind === 'video')
  if (videoSender) {
    videoSender.replaceTrack(newTrack)
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
  SCREEN_SHARE: 'screen-share',
}
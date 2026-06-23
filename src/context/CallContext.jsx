import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import {
  createPeerConnection, getLocalStream, addTracksToConnection,
  stopStream, signalingChannel, SIGNAL,
} from '../lib/webrtc'

const CallContext = createContext({})

// call status values:
// null = no call
// 'outgoing' = we called someone, waiting for answer
// 'incoming' = someone is calling us
// 'connected' = call active
// 'ended' = call just ended (brief state before null)

export function CallProvider({ children }) {
  const { user, profile } = useAuth()

  const [callStatus, setCallStatus] = useState(null)
  const [callType, setCallType] = useState(null)      // 'audio' | 'video'
  const [remoteUser, setRemoteUser] = useState(null)  // { id, display_name, avatar_url }
  const [conversationId, setConversationId] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callError, setCallError] = useState(null)

  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const durationTimerRef = useRef(null)
  const localStreamRef = useRef(null)

  // ─── helpers ────────────────────────────────────────────────

  function clearCallState() {
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    clearInterval(durationTimerRef.current)
    setLocalStream(null)
    setRemoteStream(null)
    setCallStatus(null)
    setCallType(null)
    setRemoteUser(null)
    setConversationId(null)
    setIsMuted(false)
    setIsVideoOff(false)
    setCallDuration(0)
    setCallError(null)
  }

  function startDurationTimer() {
    setCallDuration(0)
    clearInterval(durationTimerRef.current)
    durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function broadcast(event, payload) {
    channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: user.id } })
  }

  // ─── subscribe to signaling for a conversation ───────────────

  function subscribeSignaling(convId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(signalingChannel(convId))
    channelRef.current = channel

    channel
      .on('broadcast', { event: SIGNAL.RING }, async (msg) => {
        const { from, caller_name, caller_avatar, type } = msg.payload
        if (from === user.id) return
        if (callStatus) { broadcast(SIGNAL.BUSY, {}); return }
        setRemoteUser({ id: from, display_name: caller_name, avatar_url: caller_avatar })
        setCallType(type)
        setConversationId(convId)
        setCallStatus('incoming')
      })
      .on('broadcast', { event: SIGNAL.OFFER }, async (msg) => {
        if (msg.payload.from === user.id) return
        await handleOffer(msg.payload.sdp)
      })
      .on('broadcast', { event: SIGNAL.ANSWER }, async (msg) => {
        if (msg.payload.from === user.id) return
        await handleAnswer(msg.payload.sdp)
      })
      .on('broadcast', { event: SIGNAL.ICE }, async (msg) => {
        if (msg.payload.from === user.id) return
        try {
          if (pcRef.current && msg.payload.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload.candidate))
          }
        } catch { /* ignore stale ICE */ }
      })
      .on('broadcast', { event: SIGNAL.HANGUP }, () => {
        endCall(false)
      })
      .on('broadcast', { event: SIGNAL.REJECT }, () => {
        setCallError('Call declined')
        setTimeout(clearCallState, 2000)
      })
      .on('broadcast', { event: SIGNAL.BUSY }, () => {
        setCallError('User is busy')
        setTimeout(clearCallState, 2000)
      })
      .subscribe()
  }

  // ─── WebRTC offer / answer handlers ─────────────────────────

  async function setupPeerConnection(stream) {
    const pc = createPeerConnection()
    pcRef.current = pc
    addTracksToConnection(pc, stream)

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0])
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) broadcast(SIGNAL.ICE, { candidate: e.candidate })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected')
        startDurationTimer()
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall(false)
      }
    }

    return pc
  }

  async function handleOffer(sdp) {
    if (!localStreamRef.current) return
    const pc = await setupPeerConnection(localStreamRef.current)
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    broadcast(SIGNAL.ANSWER, { sdp: answer.sdp })
    setCallStatus('connected')
    startDurationTimer()
  }

  async function handleAnswer(sdp) {
    if (!pcRef.current) return
    await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start an outgoing call
   * @param {object} targetUser - { id, display_name, avatar_url }
   * @param {string} convId - conversation id
   * @param {'audio'|'video'} type
   */
  const startCall = useCallback(async (targetUser, convId, type = 'audio') => {
    if (callStatus) return
    setCallError(null)
    setRemoteUser(targetUser)
    setCallType(type)
    setConversationId(convId)
    setCallStatus('outgoing')

    subscribeSignaling(convId)

    const { stream, error } = await getLocalStream({ video: type === 'video', audio: true })
    if (error) { setCallError(error); setTimeout(clearCallState, 3000); return }
    localStreamRef.current = stream
    setLocalStream(stream)

    const pc = await setupPeerConnection(stream)

    broadcast(SIGNAL.RING, {
      caller_name: profile?.display_name,
      caller_avatar: profile?.avatar_url,
      type,
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    broadcast(SIGNAL.OFFER, { sdp: offer.sdp })
  }, [callStatus, profile, user])

  /**
   * Accept an incoming call
   */
  const acceptCall = useCallback(async () => {
    const type = callType
    const convId = conversationId

    const { stream, error } = await getLocalStream({ video: type === 'video', audio: true })
    if (error) { setCallError(error); setTimeout(clearCallState, 3000); return }
    localStreamRef.current = stream
    setLocalStream(stream)
    setCallStatus('connecting')
  }, [callType, conversationId])

  /**
   * Reject an incoming call
   */
  const rejectCall = useCallback(() => {
    broadcast(SIGNAL.REJECT, {})
    clearCallState()
  }, [conversationId])

  /**
   * End active or outgoing call
   */
  const endCall = useCallback((sendSignal = true) => {
    if (sendSignal) broadcast(SIGNAL.HANGUP, {})
    setCallStatus('ended')
    setTimeout(clearCallState, 1000)
  }, [conversationId])

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(p => !p)
  }, [])

  /**
   * Toggle video on/off
   */
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsVideoOff(p => !p)
  }, [])

  // Subscribe to signaling for all user's conversations (to receive incoming calls)
  // We re-subscribe whenever user changes
  useEffect(() => {
    if (!user) return
    // Listen on a user-specific channel for incoming ring signals
    const ch = supabase.channel(`user-calls:${user.id}`)
      .on('broadcast', { event: SIGNAL.RING }, async (msg) => {
        const { from, caller_name, caller_avatar, type, conv_id } = msg.payload
        if (from === user.id) return
        if (callStatus) {
          // busy — would need channel reference to reply, skip for now
          return
        }
        setRemoteUser({ id: from, display_name: caller_name, avatar_url: caller_avatar })
        setCallType(type)
        setConversationId(conv_id)
        setCallStatus('incoming')
        subscribeSignaling(conv_id)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  // Cleanup on unmount
  useEffect(() => () => clearCallState(), [])

  return (
    <CallContext.Provider value={{
      callStatus, callType, remoteUser, conversationId,
      localStream, remoteStream,
      isMuted, isVideoOff,
      callDuration, callError,
      startCall, acceptCall, rejectCall, endCall,
      toggleMute, toggleVideo,
    }}>
      {children}
    </CallContext.Provider>
  )
}

export const useCall = () => useContext(CallContext)
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { createPeerConnection, getLocalStream, addTracksToConnection, stopStream, SIGNAL } from '../lib/webrtc'

const CallContext = createContext({})

export function CallProvider({ children }) {
  const { user, profile } = useAuth()

  const [callStatus, setCallStatus] = useState(null)
  const [callType, setCallType] = useState(null)
  const [remoteUser, setRemoteUser] = useState(null)
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
  const dialingAudioRef = useRef(null)
  const ringAudioRef = useRef(null)
  const pendingOfferRef = useRef(null)

  // Call tracking refs
  const callStartTimeRef = useRef(null)
  const callMetaRef = useRef(null) // { callerId, receiverId, convId, type }

  // ─── Sound helpers ────────────────────────────────
  function playDialing() {
    stopSounds()
    try {
      const a = new Audio('/sounds/dialing.mp3')
      a.loop = true; a.volume = 0.5
      a.play().catch(() => {})
      dialingAudioRef.current = a
    } catch {}
  }

  function playRinging() {
    stopSounds()
    try {
      const a = new Audio('/sounds/ringtone.mp3')
      a.loop = true; a.volume = 0.7
      a.play().catch(() => {})
      ringAudioRef.current = a
    } catch {}
  }

  function stopSounds() {
    if (dialingAudioRef.current) { dialingAudioRef.current.pause(); dialingAudioRef.current = null }
    if (ringAudioRef.current) { ringAudioRef.current.pause(); ringAudioRef.current = null }
  }

  // ─── Save call to DB ──────────────────────────────
  async function saveCallRecord(status) {
    if (!callMetaRef.current) return
    const { callerId, receiverId, convId, type } = callMetaRef.current
    const duration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0

    try {
      await supabase.from('calls').insert({
        conversation_id: convId,
        caller_id: callerId,
        receiver_id: receiverId,
        call_type: type,
        status,
        duration_seconds: duration,
      })
    } catch (e) {
      console.warn('Could not save call record:', e)
    }

    callMetaRef.current = null
    callStartTimeRef.current = null
  }

  // ─── Cleanup ──────────────────────────────────────
  function clearCallState() {
    stopSounds()
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    pendingOfferRef.current = null
    callMetaRef.current = null
    callStartTimeRef.current = null
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
    callStartTimeRef.current = Date.now()
    setCallDuration(0)
    clearInterval(durationTimerRef.current)
    durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function broadcast(event, payload) {
    channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: user.id } })
  }

  // ─── Setup PeerConnection ──────────────────────────
  async function setupPeerConnection(stream) {
    if (pcRef.current) { pcRef.current.close() }
    const pc = createPeerConnection()
    pcRef.current = pc
    addTracksToConnection(pc, stream)

    pc.ontrack = (e) => {
      console.log('🎵 Remote track received!')
      setRemoteStream(e.streams[0])
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) broadcast(SIGNAL.ICE, { candidate: e.candidate })
    }

    pc.onconnectionstatechange = () => {
      console.log('📡 Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        stopSounds()
        setCallStatus('connected')
        startDurationTimer()
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall(false)
      }
    }
    return pc
  }

  // ─── Signaling subscription ────────────────────────
  function subscribeSignaling(convId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase.channel(`call:${convId}`, {
      config: { broadcast: { self: false } }
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: SIGNAL.OFFER }, async (msg) => {
        if (msg.payload.from === user.id) return
        console.log('📨 Got OFFER')
        pendingOfferRef.current = msg.payload.sdp
        if (localStreamRef.current) {
          await processOffer(msg.payload.sdp)
          pendingOfferRef.current = null
        }
      })
      .on('broadcast', { event: SIGNAL.ANSWER }, async (msg) => {
        if (msg.payload.from === user.id) return
        console.log('📨 Got ANSWER')
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: msg.payload.sdp })
          )
        }
      })
      .on('broadcast', { event: SIGNAL.ICE }, async (msg) => {
        if (msg.payload.from === user.id) return
        try {
          if (pcRef.current && msg.payload.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload.candidate))
          }
        } catch (e) { console.warn('ICE error:', e) }
      })
      .on('broadcast', { event: SIGNAL.HANGUP }, async () => {
        console.log('📨 Got HANGUP')
        // Save as completed if was connected, else missed
        const status = callStartTimeRef.current ? 'completed' : 'missed'
        await saveCallRecord(status)
        endCall(false)
      })
      .on('broadcast', { event: SIGNAL.REJECT }, async () => {
        stopSounds()
        await saveCallRecord('declined')
        setCallError('Call declined')
        setTimeout(clearCallState, 2000)
      })
      .on('broadcast', { event: SIGNAL.BUSY }, async () => {
        stopSounds()
        await saveCallRecord('missed')
        setCallError('User is busy')
        setTimeout(clearCallState, 2000)
      })
      .subscribe((status) => console.log('📡 Signal channel:', status))

    return channel
  }

  async function processOffer(sdp) {
    console.log('⚙️ Processing offer...')
    const pc = await setupPeerConnection(localStreamRef.current)
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    broadcast(SIGNAL.ANSWER, { sdp: answer.sdp })
    console.log('✅ Answer sent!')
    stopSounds()
    setCallStatus('connected')
    startDurationTimer()
  }

  // ─── Public API ────────────────────────────────────

  const startCall = useCallback(async (targetUser, convId, type = 'audio') => {
    if (callStatus) return
    setCallError(null)
    setRemoteUser(targetUser)
    setCallType(type)
    setConversationId(convId)
    setCallStatus('outgoing')

    // Store call meta for DB save
    callMetaRef.current = {
      callerId: user.id,
      receiverId: targetUser.id,
      convId,
      type,
    }

    playDialing()
    subscribeSignaling(convId)

    const { stream, error } = await getLocalStream({ video: type === 'video', audio: true })
    if (error) {
      stopSounds()
      await saveCallRecord('failed')
      setCallError('Microphone access denied')
      setTimeout(clearCallState, 3000)
      return
    }
    localStreamRef.current = stream
    setLocalStream(stream)

    // Notify receiver
    const notifyCh = supabase.channel(`user-call:${targetUser.id}`, {
      config: { broadcast: { self: false } }
    })
    await new Promise(resolve => notifyCh.subscribe(s => { if (s === 'SUBSCRIBED') resolve() }))
    notifyCh.send({
      type: 'broadcast',
      event: SIGNAL.RING,
      payload: {
        from: user.id,
        caller_name: profile?.display_name,
        caller_avatar: profile?.avatar_url,
        type,
        conv_id: convId,
      }
    })
    setTimeout(() => supabase.removeChannel(notifyCh), 3000)

    // Wait then send offer
    await new Promise(r => setTimeout(r, 2000))
    const pc = await setupPeerConnection(stream)
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === 'video',
    })
    await pc.setLocalDescription(offer)
    broadcast(SIGNAL.OFFER, { sdp: offer.sdp })
    console.log('📤 Offer sent!')

  }, [callStatus, profile, user])

  const acceptCall = useCallback(async () => {
    stopSounds()
    const type = callType

    const { stream, error } = await getLocalStream({ video: type === 'video', audio: true })
    if (error) {
      setCallError('Microphone access denied')
      setTimeout(clearCallState, 3000)
      return
    }
    localStreamRef.current = stream
    setLocalStream(stream)
    setCallStatus('connecting')

    if (pendingOfferRef.current) {
      await processOffer(pendingOfferRef.current)
      pendingOfferRef.current = null
    }
  }, [callType])

  const rejectCall = useCallback(async () => {
    stopSounds()
    broadcast(SIGNAL.REJECT, {})
    await saveCallRecord('declined')
    clearCallState()
  }, [])

  const endCall = useCallback(async (sendSignal = true) => {
    stopSounds()
    if (sendSignal) {
      broadcast(SIGNAL.HANGUP, {})
      const status = callStartTimeRef.current ? 'completed' : 'missed'
      await saveCallRecord(status)
    }
    setCallStatus('ended')
    setTimeout(clearCallState, 1200)
  }, [])

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(p => !p)
  }, [])

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsVideoOff(p => !p)
  }, [])

  // ─── Listen for incoming ring ──────────────────────
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel(`user-call:${user.id}`, {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: SIGNAL.RING }, (msg) => {
        const { from, caller_name, caller_avatar, type, conv_id } = msg.payload
        if (from === user.id) return
        if (callStatus) return

        console.log('📲 Incoming call from', caller_name)

        // Store call meta (receiver side)
        callMetaRef.current = {
          callerId: from,
          receiverId: user.id,
          convId: conv_id,
          type,
        }

        setRemoteUser({ id: from, display_name: caller_name, avatar_url: caller_avatar })
        setCallType(type)
        setConversationId(conv_id)
        setCallStatus('incoming')
        subscribeSignaling(conv_id)
        playRinging()
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [user?.id, callStatus])

  useEffect(() => () => clearCallState(), [])

  return (
    <CallContext.Provider value={{
      callStatus, callType, remoteUser, conversationId,
      localStream, remoteStream,
      isMuted, isVideoOff, callDuration, callError,
      startCall, acceptCall, rejectCall, endCall,
      toggleMute, toggleVideo,
    }}>
      {children}
    </CallContext.Provider>
  )
}

export const useCall = () => useContext(CallContext)
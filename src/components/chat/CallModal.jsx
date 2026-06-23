import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useCall } from '../../context/CallContext'
import Avatar from '../ui/Avatar'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CallModal() {
  const {
    callStatus, callType, remoteUser, callDuration, callError,
    localStream, remoteStream,
    isMuted, isVideoOff,
    acceptCall, rejectCall, endCall, toggleMute, toggleVideo,
  } = useCall()

  const localVideoRef = useRef()
  const remoteVideoRef = useRef()

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  // ⚠️ CRITICAL: agar call nahi hai toh KUCH BHI render mat karo
  if (!callStatus || !remoteUser) return null

  const isVideo = callType === 'video'
  const isIncoming = callStatus === 'incoming'
  const isConnected = callStatus === 'connected'
  const isOutgoing = callStatus === 'outgoing'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 20, 0.92)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Remote video bg */}
      {isVideo && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
        />
      )}

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        padding: '48px 32px',
      }}>
        {/* Avatar + Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={remoteUser?.avatar_url} name={remoteUser?.display_name} size={20} />
            {isIncoming && (
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                border: '2px solid #7C5CFC',
                animation: 'ring-pulse 1.5s ease-out infinite',
              }} />
            )}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'white' }}>
            {remoteUser?.display_name}
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
            {isIncoming && '📲 Incoming call...'}
            {isOutgoing && '📡 Calling...'}
            {isConnected && formatDuration(callDuration)}
            {callStatus === 'ended' && 'Call ended'}
            {callError && <span style={{ color: '#FF5470' }}>{callError}</span>}
          </div>
        </div>

        {/* Local video pip */}
        {isVideo && localStream && (
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            style={{
              position: 'absolute', bottom: 120, right: 24,
              width: 120, height: 160, borderRadius: 12,
              objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)',
              background: '#111',
            }}
          />
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {/* Mute */}
          {(isConnected || isOutgoing) && (
            <CallBtn onClick={toggleMute} active={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </CallBtn>
          )}

          {/* Video toggle */}
          {isVideo && (isConnected || isOutgoing) && (
            <CallBtn onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? 'Start video' : 'Stop video'}>
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </CallBtn>
          )}

          {/* Accept (incoming) */}
          {isIncoming && (
            <CallBtn onClick={acceptCall} color="#22D48F" label="Accept">
              <Phone size={22} />
            </CallBtn>
          )}

          {/* End / Reject */}
          <CallBtn onClick={() => isIncoming ? rejectCall() : endCall()} color="#FF5470" label={isIncoming ? 'Decline' : 'End'}>
            <PhoneOff size={22} />
          </CallBtn>
        </div>
      </div>

      <style>{`
        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function CallBtn({ onClick, children, label, active = false, color }) {
  const bg = color ? color : active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)'
  const clr = color ? 'white' : active ? '#111' : 'white'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: 60, height: 60, borderRadius: '50%',
          border: 'none', background: bg, color: clr,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, transition: 'all 0.2s',
        }}
      >
        {children}
      </button>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </div>
  )
}
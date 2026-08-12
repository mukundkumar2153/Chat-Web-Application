import { useEffect, useRef, useCallback } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff } from 'lucide-react'
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
    isMuted, isVideoOff, isScreenSharing,
    acceptCall, rejectCall, endCall, toggleMute, toggleVideo, toggleScreenShare,
  } = useCall()

  // Callback refs — fire immediately when DOM node mounts, no useEffect race condition
  const localVideoRef = useCallback((node) => {
    if (node && localStream) {
      node.srcObject = localStream
    }
  }, [localStream])

  const remoteVideoRef = useCallback((node) => {
    if (node && remoteStream) {
      node.srcObject = remoteStream
      node.play().catch(() => {})
    }
  }, [remoteStream])

  // Also update srcObject when streams change after mount
  const localVideoElRef = useRef(null)
  const remoteVideoElRef = useRef(null)

  useEffect(() => {
    if (localVideoElRef.current && localStream) {
      localVideoElRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoElRef.current && remoteStream) {
      remoteVideoElRef.current.srcObject = remoteStream
      remoteVideoElRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  if (!callStatus || !remoteUser) return null

  const isVideo = callType === 'video'
  const isIncoming = callStatus === 'incoming'
  const isConnected = callStatus === 'connected'
  const isOutgoing = callStatus === 'outgoing'
  const isConnecting = callStatus === 'connecting'

  function statusText() {
    if (callError) return null
    if (isIncoming) return '📲 Incoming call...'
    if (isOutgoing) return '📡 Calling...'
    if (isConnecting) return '🔗 Connecting...'
    if (isConnected) return formatDuration(callDuration)
    if (callStatus === 'ended') return 'Call ended'
    return ''
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8, 8, 18, 0.95)',
      backdropFilter: 'blur(16px)',
    }}>

      {/* ── Remote video fullscreen background ── */}
      {isVideo && remoteStream && (
        <video
          ref={node => { remoteVideoElRef.current = node; if (node && remoteStream) { node.srcObject = remoteStream; node.play().catch(()=>{}) } }}
          autoPlay playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: 0.85,
          }}
        />
      )}

      {/* ── Dark gradient overlay ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isVideo && remoteStream
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, rgba(0,0,0,0.7) 80%)'
          : 'radial-gradient(ellipse at center, rgba(124,92,252,0.15) 0%, transparent 70%)',
      }} />

      {/* ── Main content ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        width: '100%', height: '100%',
        padding: '48px 24px 40px',
      }}>

        {/* Top: Avatar + Name + Status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            {/* Pulse rings for incoming */}
            {isIncoming && [1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                inset: -(i * 14),
                borderRadius: '50%',
                border: '1.5px solid rgba(124,92,252,0.5)',
                animation: `ring-pulse 1.8s ease-out ${i * 0.3}s infinite`,
              }} />
            ))}
            <Avatar src={remoteUser?.avatar_url} name={remoteUser?.display_name} size={22} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              {remoteUser?.display_name}
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', minHeight: 22 }}>
              {callError
                ? <span style={{ color: '#FF5470' }}>{callError}</span>
                : statusText()
              }
            </div>
            {isScreenSharing && (
              <div style={{
                marginTop: 8, fontSize: 12,
                color: '#22D48F',
                background: 'rgba(34,212,143,0.15)',
                borderRadius: 20, padding: '4px 12px',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Monitor size={12} /> Screen sharing active
              </div>
            )}
          </div>
        </div>

        {/* Middle spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>

          {/* Active call controls */}
          {(isConnected || isOutgoing || isConnecting) && (
            <div style={{
              display: 'flex', gap: 16, alignItems: 'center',
              flexWrap: 'wrap', justifyContent: 'center',
            }}>
              {/* Mute */}
              <CallBtn onClick={toggleMute} active={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </CallBtn>

              {/* Video toggle */}
              {isVideo && (
                <CallBtn onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? 'Camera On' : 'Camera Off'}>
                  {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                </CallBtn>
              )}

              {/* Screen Share — only available when connected on video call */}
              {isVideo && isConnected && (
                <CallBtn onClick={toggleScreenShare} active={isScreenSharing} label={isScreenSharing ? 'Stop Share' : 'Share Screen'} activeColor="#22D48F">
                  {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
                </CallBtn>
              )}
            </div>
          )}

          {/* Incoming: Accept + Decline */}
          {isIncoming && (
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <CallBtn onClick={rejectCall} color="#FF5470" label="Decline">
                <PhoneOff size={22} />
              </CallBtn>
              <CallBtn onClick={acceptCall} color="#22D48F" label="Accept">
                <Phone size={22} />
              </CallBtn>
            </div>
          )}

          {/* End call button */}
          {!isIncoming && (
            <CallBtn onClick={() => endCall(true)} color="#FF5470" label="End Call" large>
              <PhoneOff size={24} />
            </CallBtn>
          )}
        </div>
      </div>

      {/* ── Local video PiP (bottom-right) ── */}
      {isVideo && localStream && (
        <video
          ref={node => { localVideoElRef.current = node; if (node && localStream) { node.srcObject = localStream } }}
          autoPlay playsInline muted
          style={{
            position: 'absolute',
            bottom: 140, right: 20,
            width: 110, height: 150,
            borderRadius: 14,
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.25)',
            background: '#111',
            zIndex: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        />
      )}

      <style>{`
        @keyframes ring-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function CallBtn({ onClick, children, label, active = false, color, activeColor, large = false }) {
  const size = large ? 68 : 58
  let bg = 'rgba(255,255,255,0.12)'
  let clr = 'white'
  if (color) { bg = color; clr = 'white' }
  else if (active) {
    bg = activeColor ? `${activeColor}30` : 'rgba(255,255,255,0.9)'
    clr = activeColor || '#111'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          border: active && activeColor ? `2px solid ${activeColor}` : 'none',
          background: bg, color: clr,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: color ? `0 4px 20px ${color}50` : 'none',
        }}
      >
        {children}
      </button>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}
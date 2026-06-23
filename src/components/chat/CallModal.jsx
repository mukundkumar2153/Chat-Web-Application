import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useCall } from '../../context/CallContext'
import Avatar from '../ui/Avatar'

export default function CallModal() {
  const {
    callState, callType, remoteUser, localStream, remoteStream,
    muted, cameraOff, callError, callStartedAt,
    acceptCall, declineCall, endCall, toggleMute, toggleCamera,
  } = useCall()

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null
  }, [localStream])

  useEffect(() => {
    if (callType === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null
    if (callType === 'voice' && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null
  }, [remoteStream, callType])

  useEffect(() => {
    if (callState !== 'connected' || !callStartedAt) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [callState, callStartedAt])

  if (callState === 'idle') return null

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="call-overlay">
      {callType === 'video' && callState === 'connected' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" />
      )}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="call-content">
        {!(callType === 'video' && callState === 'connected') && (
          <Avatar src={remoteUser?.avatar_url} name={remoteUser?.display_name} size={20} />
        )}
        <div className="call-name">{remoteUser?.display_name || 'Unknown'}</div>
        <div className="call-status">
          {callError ? callError
            : callState === 'outgoing' ? 'Calling…'
            : callState === 'incoming' ? `Incoming ${callType} call…`
            : callState === 'connected' ? fmt(elapsed)
            : ''}
        </div>

        {callType === 'video' && callState === 'connected' && (
          <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
        )}
      </div>

      <div className="call-actions">
        {callState === 'incoming' ? (
          <>
            <button className="call-btn decline" onClick={declineCall}><PhoneOff size={24} /></button>
            <button className="call-btn accept" onClick={acceptCall}><Phone size={24} /></button>
          </>
        ) : (
          <>
            {(callState === 'connected') && (
              <>
                <button className="call-btn secondary" onClick={toggleMute}>
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                {callType === 'video' && (
                  <button className="call-btn secondary" onClick={toggleCamera}>
                    {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}
              </>
            )}
            <button className="call-btn decline" onClick={() => endCall('ended')}><PhoneOff size={24} /></button>
          </>
        )}
      </div>
    </div>
  )
}
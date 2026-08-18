import { useState, useEffect, useRef } from 'react'
import { QrCode, Shield, CheckCircle2, X, RefreshCw, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { startPrimaryQRSession } from '../../lib/qrLinking'

export default function QRLinkModal({ user, onClose }) {
  const [timeLeft, setTimeLeft] = useState(60)
  const [status, setStatus] = useState('waiting') // 'waiting' | 'requesting' | 'linked'
  const [linkedDeviceName, setLinkedDeviceName] = useState('')
  const canvasRef = useRef(null)
  const sessionRef = useRef(null)

  function initSession() {
    if (sessionRef.current?.cleanup) sessionRef.current.cleanup()

    const session = startPrimaryQRSession({
      user,
      onDeviceRequest: ({ deviceName }) => {
        setStatus('requesting')
        setLinkedDeviceName(deviceName)
      },
      onDeviceLinked: ({ deviceName }) => {
        setStatus('linked')
        setLinkedDeviceName(deviceName)
        setTimeout(() => onClose?.(), 2500)
      },
    })

    sessionRef.current = session
    setTimeLeft(60)
    setStatus('waiting')

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, session.qrData, {
        width: 230,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).catch(err => console.error('QR rendering error:', err))
    }
  }

  useEffect(() => {
    initSession()

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(timer)
      if (sessionRef.current?.cleanup) sessionRef.current.cleanup()
    }
  }, [user])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--accent-dim)', padding: 8, borderRadius: 10, color: 'var(--accent)' }}>
              <QrCode size={22} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="modal-title" style={{ margin: 0 }}>Link a Device</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Scan QR code from new device</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {status === 'linked' ? (
          <div style={{ padding: '30px 10px' }}>
            <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Device Linked Successfully!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {linkedDeviceName || 'New Device'} is now connected to your WaveChat account.
            </div>
          </div>
        ) : (
          <>
            <div style={{
              background: 'white', padding: 16, borderRadius: 16, display: 'inline-block',
              boxShadow: 'var(--shadow-md)', marginBottom: 16, position: 'relative'
            }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8 }} />
              {timeLeft === 0 && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                  borderRadius: 16, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, color: 'white'
                }}>
                  <div style={{ fontSize: 13 }}>QR code expired</div>
                  <button
                    className="primary-btn"
                    onClick={initSession}
                    style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={14} /> Reload QR
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Open WaveChat on your second phone or computer and select <strong style={{ color: 'var(--text-primary)' }}>"Scan QR to Link"</strong>.
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-secondary)', padding: '6px 14px', borderRadius: 20,
              fontSize: 12, color: 'var(--text-muted)'
            }}>
              <Shield size={14} color="var(--accent)" />
              <span>Expires in {timeLeft} seconds • End-to-end encrypted</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { scanAndConnectDevice } from '../../lib/qrLinking'

export default function QRScanModal({ onClose, onSuccess }) {
  const [status, setStatus] = useState('scanning') // 'scanning' | 'connecting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)

  useEffect(() => {
    const readerId = 'qr-reader-element'
    const html5Qrcode = new Html5Qrcode(readerId)
    scannerRef.current = html5Qrcode

    const config = { fps: 10, qrbox: { width: 220, height: 220 } }

    html5Qrcode
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (isScanningRef.current) return
          isScanningRef.current = true
          html5Qrcode.stop().catch(() => {})

          setStatus('connecting')

          scanAndConnectDevice({
            qrDataString: decodedText,
            deviceName: window.navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser',
            onSuccess: ({ userId }) => {
              setStatus('success')
              setTimeout(() => {
                onSuccess?.(userId)
                onClose?.()
              }, 1800)
            },
            onError: (err) => {
              setStatus('error')
              setErrorMessage(err.message || 'Failed to connect device')
            },
          })
        },
        () => {}
      )
      .catch((err) => {
        setStatus('error')
        setErrorMessage('Camera access denied or unreadable. Please allow camera permissions.')
      })

    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--accent-dim)', padding: 8, borderRadius: 10, color: 'var(--accent)' }}>
              <Camera size={22} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="modal-title" style={{ margin: 0 }}>Scan QR Code</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Point camera at Primary Device QR</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {status === 'success' ? (
          <div style={{ padding: '30px 10px' }}>
            <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Device Linked Successfully!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Private key received & encrypted. Reloading WaveChat...
            </div>
          </div>
        ) : status === 'connecting' ? (
          <div style={{ padding: '40px 10px' }}>
            <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Pairing devices...
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Securing device-to-device end-to-end key transfer
            </div>
          </div>
        ) : status === 'error' ? (
          <div style={{ padding: '20px 10px' }}>
            <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
              Scanning Failed
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {errorMessage}
            </div>
            <button className="primary-btn" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : (
          <div>
            <div
              id="qr-reader-element"
              style={{
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#000',
                border: '1px solid var(--border)',
                marginBottom: 16,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Position the QR code from your primary device inside the camera box above.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

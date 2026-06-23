import { useState } from 'react'
import { Lock, Waves } from 'lucide-react'
import { verifyPin } from '../../lib/appLock'

export default function AppLockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await verifyAppLockPin(pin)
    if (ok) onUnlock()
    else { setError(true); setPin(''); setTimeout(() => setError(false), 1500) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo" style={{ justifyContent: 'center' }}>
          <div className="auth-logo-icon"><Waves size={26} color="white" /></div>
        </div>
        <div className="auth-title"><Lock size={18} style={{ marginRight: 6, verticalAlign: -2 }} />WaveChat is locked</div>
        <div className="auth-sub">Enter your PIN to continue</div>
        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, borderColor: error ? 'var(--danger)' : undefined }}
            autoFocus
          />
          <button type="submit" className="btn-primary" style={{ marginTop: 16 }} disabled={pin.length < 4}>Unlock</button>
        </form>
      </div>
    </div>
  )
}
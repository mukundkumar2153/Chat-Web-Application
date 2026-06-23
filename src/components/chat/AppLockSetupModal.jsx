import { useState } from 'react'
import { X, Lock, Unlock, Eye, EyeOff } from 'lucide-react'
import { setPin, removePin, isAppLockEnabled, verifyPin } from '../../lib/appLock'

export default function AppLockSetupModal({ onClose }) {
  const enabled = isAppLockEnabled()
  const [step, setStep] = useState(enabled ? 'disable' : 'enter') // enter | confirm | disable
  const [pin, setLocalPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function handleSetPin() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }
    setError('')
    setStep('confirm')
  }

  function handleConfirmPin() {
    if (confirmPin !== pin) {
      setError('PINs do not match. Try again.')
      setConfirmPin('')
      return
    }
    setPin(pin)
    setSuccess('App lock enabled!')
    setTimeout(onClose, 1200)
  }

  function handleDisable() {
    if (!verifyPin(currentPin)) {
      setError('Wrong PIN')
      setCurrentPin('')
      return
    }
    removePin()
    setSuccess('App lock disabled!')
    setTimeout(onClose, 1200)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {enabled ? <Unlock size={18} /> : <Lock size={18} />}
            {enabled ? 'Disable App Lock' : 'Set App Lock PIN'}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {success && (
          <div style={{ background: 'var(--online)', color: 'white', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            ✅ {success}
          </div>
        )}

        {/* Step: Enter new PIN */}
        {step === 'enter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Set a 4-digit PIN to lock WaveChat when you leave.
            </p>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={e => { setLocalPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
                autoFocus
              />
              <button
                className="icon-btn"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowPin(p => !p)}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
            <button className="btn-primary" onClick={handleSetPin} disabled={pin.length !== 4}>
              Continue
            </button>
          </div>
        )}

        {/* Step: Confirm PIN */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Confirm your PIN to make sure you remember it.
            </p>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                placeholder="Confirm 4-digit PIN"
                value={confirmPin}
                onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
                autoFocus
              />
              <button
                className="icon-btn"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowPin(p => !p)}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => { setStep('enter'); setConfirmPin(''); setError('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Back
              </button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirmPin} disabled={confirmPin.length !== 4}>
                Enable Lock
              </button>
            </div>
          </div>
        )}

        {/* Step: Disable (verify current PIN) */}
        {step === 'disable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Enter your current PIN to disable app lock.
            </p>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                placeholder="Current PIN"
                value={currentPin}
                onChange={e => { setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
                autoFocus
              />
              <button
                className="icon-btn"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowPin(p => !p)}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
            <button
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleDisable}
              disabled={currentPin.length !== 4}
            >
              Disable App Lock
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
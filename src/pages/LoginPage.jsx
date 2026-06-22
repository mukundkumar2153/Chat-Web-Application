import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Mail, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // email | otp
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = useRef([])

  async function handleSendOTP(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('otp')
    startResendTimer()
  }

  function startResendTimer() {
    setResendTimer(60)
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
    if (newOtp.every(d => d !== '')) verifyOtp(newOtp.join(''))
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      const newOtp = text.split('')
      setOtp(newOtp)
      otpRefs.current[5]?.focus()
      verifyOtp(text)
    }
  }

  async function verifyOtp(code) {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)
    if (error) {
      setError('Invalid or expired code. Try again.')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Waves size={26} color="white" />
          </div>
          <span className="auth-logo-name">WaveChat</span>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP}>
            <div className="auth-title">Welcome back</div>
            <div className="auth-sub">Enter your email to sign in or create an account</div>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="error-msg">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim()}
              style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (
                <><Mail size={16} /> Continue with Email</>
              )}
            </button>
          </form>
        ) : (
          <div>
            <div className="auth-title">Check your email</div>
            <div className="auth-sub">
              We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
            </div>

            <div className="otp-inputs" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  className="otp-digit"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <div className="error-msg" style={{ marginTop: '12px' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Verifying...
              </div>
            )}

            <button
              className="btn-ghost"
              onClick={() => { setStep('email'); setOtp(['','','','','','']); setError('') }}
              style={{ marginTop: '20px' }}
            >
              ← Change email
            </button>

            {resendTimer > 0 ? (
              <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
                Resend code in {resendTimer}s
              </div>
            ) : (
              <button className="btn-ghost" onClick={handleSendOTP} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <RefreshCw size={14} /> Resend code
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: '28px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          By continuing, you agree to WaveChat's Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  )
}

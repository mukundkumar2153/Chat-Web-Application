import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Mail, Lock, Eye, EyeOff, RefreshCw, AlertCircle, UserPlus, LogIn, KeyRound, CheckCircle } from 'lucide-react'

// ── OTP Input — defined OUTSIDE component to prevent remount ──
function OtpInputs({ otp, setOtp, otpRefs, onComplete }) {
  useEffect(() => {
    setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }, [])

  function handleChange(index, value) {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) {
      setTimeout(() => otpRefs.current[index + 1]?.focus(), 10)
    }
    if (next.every(d => d !== '')) onComplete(next.join(''))
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      const arr = text.split('')
      setOtp(arr)
      setTimeout(() => otpRefs.current[5]?.focus(), 10)
      onComplete(text)
    }
  }

  return (
    <div
      style={{ display: 'flex', gap: 8, justifyContent: 'center', width: '100%', margin: '20px 0' }}
      onPaste={handlePaste}
    >
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={el => otpRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: 52,
            height: 52,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            background: 'var(--bg-elevated)',
            border: '2px solid var(--border)',
            borderRadius: 12,
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = useRef([])

  function startResendTimer() {
    setResendTimer(60)
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function resetOtp() {
    setOtp(['', '', '', '', '', ''])
    setTimeout(() => otpRefs.current[0]?.focus(), 100)
  }

  // ── LOGIN ──────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      if (error.message.includes('Invalid login credentials')) setError('Wrong email or password.')
      else if (error.message.includes('Email not confirmed')) setError('Please verify your email first.')
      else setError(error.message)
      return
    }
    navigate('/')
  }

  // ── REGISTER ───────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: window.location.origin }
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    resetOtp(); setStep('otp'); startResendTimer()
  }

  // ── SIGNUP OTP ─────────────────────────────────────
  async function verifySignupOtp(code) {
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    setLoading(false)
    if (error) { setError('Invalid or expired code. Try again.'); resetOtp() }
    else navigate('/')
  }

  async function handleResendSignup() {
    setLoading(true)
    await supabase.auth.resend({ type: 'signup', email })
    setLoading(false); startResendTimer()
  }

  // ── FORGOT - Send OTP ──────────────────────────────
  async function handleForgotSend(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(), options: { shouldCreateUser: false }
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    resetOtp(); setStep('forgot-otp'); startResendTimer()
  }

  // ── FORGOT OTP VERIFY ──────────────────────────────
  async function verifyForgotOtp(code) {
    if (!code || code.length < 6) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)
    if (error) { setError('Invalid or expired code. Try again.'); resetOtp() }
    else setStep('new-password')
  }

  async function handleResendForgot() {
    setLoading(true)
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setLoading(false); startResendTimer()
  }

  // ── SET NEW PASSWORD ───────────────────────────────
  async function handleSetNewPassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Password updated successfully!')
    setTimeout(() => { setStep('login'); setNewPassword(''); setConfirmNewPassword(''); setSuccess('') }, 2000)
  }

  // ── Shared styles ──────────────────────────────────
  const inputWrap = { position: 'relative', display: 'flex', alignItems: 'center' }
  const iconLeft = { position: 'absolute', left: 12, color: 'var(--text-muted)', pointerEvents: 'none' }
  const iconRight = { position: 'absolute', right: 12, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }
  const padded = { paddingLeft: 40, paddingRight: 40 }

  function ResendRow({ onResend }) {
    return resendTimer > 0 ? (
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
        Resend code in {resendTimer}s
      </div>
    ) : (
      <button className="btn-ghost" onClick={onResend}
        style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <RefreshCw size={14} /> Resend code
      </button>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Waves size={26} color="white" /></div>
          <span className="auth-logo-name">WaveChat</span>
        </div>

        {/* ── LOGIN ── */}
        {step === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="auth-title">Welcome back</div>
            <div className="auth-sub">Sign in to your account</div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div style={inputWrap}>
                <Mail size={16} style={iconLeft} />
                <input className="form-input" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} style={padded} autoFocus required />
              </div>
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                <button type="button" onClick={() => { setStep('forgot'); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>
                  Forgot password?
                </button>
              </div>
              <div style={inputWrap}>
                <Lock size={16} style={iconLeft} />
                <input className="form-input" type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password" value={password}
                  onChange={e => setPassword(e.target.value)} style={padded} required />
                <button type="button" style={iconRight} onClick={() => setShowPassword(p => !p)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading || !email.trim() || !password}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><LogIn size={16} /> Sign In</>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <button type="button" onClick={() => { setStep('register'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Create account
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER ── */}
        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="auth-title">Create account</div>
            <div className="auth-sub">Join WaveChat today</div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div style={inputWrap}>
                <Mail size={16} style={iconLeft} />
                <input className="form-input" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} style={padded} autoFocus required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={inputWrap}>
                <Lock size={16} style={iconLeft} />
                <input className="form-input" type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)} style={padded} required />
                <button type="button" style={iconRight} onClick={() => setShowPassword(p => !p)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={inputWrap}>
                <Lock size={16} style={iconLeft} />
                <input className="form-input" type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} style={padded} required />
                <button type="button" style={iconRight} onClick={() => setShowConfirm(p => !p)}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading || !email.trim() || !password || !confirmPassword}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><UserPlus size={16} /> Create Account</>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setStep('login'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* ── OTP VERIFY (signup) ── */}
        {step === 'otp' && (
          <div>
            <div className="auth-title">Verify your email</div>
            <div className="auth-sub">We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></div>
            <OtpInputs otp={otp} setOtp={setOtp} otpRefs={otpRefs} onComplete={verifySignupOtp} />
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Verifying...
            </div>}
            <button className="btn-primary" disabled={loading || otp.some(d => d === '')}
              onClick={() => verifySignupOtp(otp.join(''))}
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><CheckCircle size={16} /> Verify</>}
            </button>
            <button className="btn-ghost" onClick={() => { setStep('register'); resetOtp(); setError('') }} style={{ marginTop: 8 }}>← Go back</button>
            <ResendRow onResend={handleResendSignup} />
          </div>
        )}

        {/* ── FORGOT - Enter Email ── */}
        {step === 'forgot' && (
          <form onSubmit={handleForgotSend}>
            <div className="auth-title">Forgot password?</div>
            <div className="auth-sub">Enter your email — we'll send a verification code</div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div style={inputWrap}>
                <Mail size={16} style={iconLeft} />
                <input className="form-input" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} style={padded} autoFocus required />
              </div>
            </div>
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading || !email.trim()}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Mail size={16} /> Send OTP</>}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setStep('login'); setError('') }} style={{ marginTop: 8 }}>← Back to login</button>
          </form>
        )}

        {/* ── FORGOT - Enter OTP ── */}
        {step === 'forgot-otp' && (
          <div>
            <div className="auth-title">Enter OTP</div>
            <div className="auth-sub">6-digit code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></div>
            <OtpInputs otp={otp} setOtp={setOtp} otpRefs={otpRefs} onComplete={verifyForgotOtp} />
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Verifying...
            </div>}
            <button className="btn-primary" disabled={loading || otp.some(d => d === '')}
              onClick={() => verifyForgotOtp(otp.join(''))}
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><KeyRound size={16} /> Verify OTP</>}
            </button>
            <button className="btn-ghost" onClick={() => { setStep('forgot'); resetOtp(); setError('') }} style={{ marginTop: 8 }}>← Go back</button>
            <ResendRow onResend={handleResendForgot} />
          </div>
        )}

        {/* ── SET NEW PASSWORD ── */}
        {step === 'new-password' && (
          <form onSubmit={handleSetNewPassword}>
            <div className="auth-title">Set new password</div>
            <div className="auth-sub">Choose a strong new password</div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={inputWrap}>
                <Lock size={16} style={iconLeft} />
                <input className="form-input" type={showNew ? 'text' : 'password'}
                  placeholder="Min. 6 characters" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} style={padded} autoFocus required />
                <button type="button" style={iconRight} onClick={() => setShowNew(p => !p)}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div style={inputWrap}>
                <Lock size={16} style={iconLeft} />
                <input className="form-input" type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password" value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)} style={padded} required />
                <button type="button" style={iconRight} onClick={() => setShowConfirm(p => !p)}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
            {success && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--online)', fontSize: 13, marginTop: 8, fontWeight: 600 }}>
              <CheckCircle size={16} /> {success}
            </div>}
            <button type="submit" className="btn-primary" disabled={loading || !newPassword || !confirmNewPassword}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><KeyRound size={16} /> Update Password</>}
            </button>
          </form>
        )}

        <div style={{ marginTop: 24, padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          By continuing, you agree to WaveChat's Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  )
}
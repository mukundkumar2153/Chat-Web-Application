import { useState, useEffect } from 'react'
import { Key, Copy, Check, ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { generateMnemonicPassphrase, saveKeyBackupToSupabase } from '../../lib/keyBackup'

export default function PassphraseSetupModal({ userId, onClose, onComplete }) {
  const [passphrase, setPassphrase] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setPassphrase(generateMnemonicPassphrase())
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(passphrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSaveBackup() {
    if (!confirmed) {
      setError('Please check the box confirming you saved your passphrase.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveKeyBackupToSupabase(userId, passphrase)
      onComplete?.(passphrase)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save encrypted key backup to cloud')
    } finally {
      setSaving(false)
    }
  }

  const words = passphrase.split(' ')

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--accent-dim)', padding: 8, borderRadius: 10, color: 'var(--accent)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="modal-title" style={{ margin: 0 }}>Recovery Passphrase</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Restore your account on new devices</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ background: 'rgba(255, 193, 7, 0.08)', border: '1px solid rgba(255, 193, 7, 0.25)', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color="#ffc107" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: '#ffc107' }}>Write down these 12 words in order!</strong><br />
            If you log in on a new device or clear browser storage, this passphrase is the ONLY way to recover your encrypted messages.
          </div>
        </div>

        {/* 12 Words Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          background: 'var(--bg-secondary)',
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          {words.map((w, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 18 }}>{idx + 1}.</span>
              <span>{w}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleCopy}
            className="action-btn"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 500
            }}
          >
            {copied ? <Check size={16} color="var(--accent)" /> : <Copy size={16} />}
            {copied ? 'Copied to Clipboard!' : 'Copy 12 Words'}
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--accent)' }}
          />
          <span>I have securely written down or saved my 12-word recovery passphrase.</span>
        </label>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button
            className="primary-btn"
            onClick={handleSaveBackup}
            disabled={saving || !confirmed}
            style={{ opacity: saving || !confirmed ? 0.6 : 1 }}
          >
            {saving ? 'Encrypting & Saving...' : 'Save Encrypted Backup'}
          </button>
        </div>
      </div>
    </div>
  )
}

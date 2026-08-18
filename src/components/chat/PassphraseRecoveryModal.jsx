import { useState } from 'react'
import { Key, Lock, ArrowRight, AlertCircle, X, Check } from 'lucide-react'
import { restorePrivateKeyFromBackup } from '../../lib/keyBackup'

export default function PassphraseRecoveryModal({ userId, onClose, onSuccess }) {
  const [passphraseInput, setPassphraseInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRestore() {
    if (!passphraseInput.trim()) {
      setError('Please enter your 12-word recovery passphrase.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await restorePrivateKeyFromBackup(userId, passphraseInput.trim())
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Incorrect passphrase. Decryption failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--accent-dim)', padding: 8, borderRadius: 10, color: 'var(--accent)' }}>
              <Key size={22} />
            </div>
            <div>
              <div className="modal-title" style={{ margin: 0 }}>Restore Account Encryption</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enter your 12-word passphrase to decrypt chats</div>
            </div>
          </div>
          {onClose && <button className="icon-btn" onClick={onClose}><X size={18} /></button>}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Enter the 12-word recovery passphrase you saved when you set up your WaveChat account.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            12-Word Recovery Passphrase
          </label>
          <textarea
            rows={3}
            value={passphraseInput}
            onChange={e => setPassphraseInput(e.target.value)}
            placeholder="e.g. abandon ability able about above absent absorb abstract absurd abuse access accident"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: 13,
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--danger)', fontSize: 13, marginBottom: 16,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            padding: '10px 12px', borderRadius: 8
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {onClose && <button className="secondary-btn" onClick={onClose}>Cancel</button>}
          <button
            className="primary-btn"
            onClick={handleRestore}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>{loading ? 'Decrypting Key...' : 'Decrypt & Restore'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

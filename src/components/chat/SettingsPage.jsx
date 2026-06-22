import { useState, useRef } from 'react'
import {
  ArrowLeft, Camera, Bell, Lock, Shield, Palette, UserX,
  LogOut, Trash2, ChevronRight, Moon, Sun, Eye, EyeOff, ShieldCheck, AlertTriangle, KeyRound
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fingerprint } from '../../lib/crypto'
import Avatar from '../ui/Avatar'

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle}>
      <div className="toggle-thumb" />
    </div>
  )
}

export default function SettingsPage({ onBack }) {
  const { user, profile, updateProfile, signOut, encryptionStatus, resetEncryptionKeys } = useAuth()
  const [resetting, setResetting] = useState(false)
  const [editName, setEditName] = useState(false)
  const [editStatus, setEditStatus] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [statusText, setStatusText] = useState(profile?.status_text || '')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const [notifs, setNotifs] = useState(profile?.notifications_enabled ?? true)
  const [privacyLastSeen, setPrivacyLastSeen] = useState(profile?.privacy_last_seen || 'everyone')
  const [privacyPhoto, setPrivacyPhoto] = useState(profile?.privacy_profile_photo || 'everyone')

  async function saveField(field, value) {
    setSaving(true)
    await updateProfile({ [field]: value })
    setSaving(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile({ avatar_url: publicUrl })
    }
  }

  async function handleToggleNotifs() {
    const val = !notifs
    setNotifs(val)
    await saveField('notifications_enabled', val)
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="settings-header-title">Settings</div>
      </div>

      <div className="settings-body">
        {/* Profile Card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={16} />
            <div
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-surface)' }}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={13} color="white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '15px', fontWeight: 700 }}
                  autoFocus
                />
                <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }} onClick={() => { saveField('display_name', displayName); setEditName(false) }}>
                  Save
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-display)', cursor: 'pointer', marginBottom: '4px' }} onClick={() => setEditName(true)}>
                {profile?.display_name}
              </div>
            )}
            {editStatus ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="form-input"
                  value={statusText}
                  onChange={e => setStatusText(e.target.value)}
                  style={{ padding: '5px 10px', fontSize: '13px' }}
                  autoFocus
                />
                <button className="btn-primary" style={{ width: 'auto', padding: '5px 12px', fontSize: '12px' }} onClick={() => { saveField('status_text', statusText); setEditStatus(false) }}>
                  Save
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditStatus(true)}>
                {profile?.status_text || 'Add status...'}
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{user?.email}</div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <div className="settings-section-title">Notifications</div>
          <div className="settings-row" onClick={handleToggleNotifs}>
            <div className="settings-row-left">
              <div className="settings-row-icon"><Bell size={16} /></div>
              <div>
                <div className="settings-row-label">Push Notifications</div>
                <div className="settings-row-sub">Receive message alerts</div>
              </div>
            </div>
            <Toggle on={notifs} onToggle={handleToggleNotifs} />
          </div>
        </div>

        {/* Privacy */}
        <div className="settings-section">
          <div className="settings-section-title">Privacy</div>
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon"><Eye size={16} /></div>
              <div>
                <div className="settings-row-label">Last Seen</div>
                <div className="settings-row-sub">Who can see when you were last online</div>
              </div>
            </div>
            <select
              value={privacyLastSeen}
              onChange={e => { setPrivacyLastSeen(e.target.value); saveField('privacy_last_seen', e.target.value) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">Contacts</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon"><Camera size={16} /></div>
              <div>
                <div className="settings-row-label">Profile Photo</div>
                <div className="settings-row-sub">Who can see your profile picture</div>
              </div>
            </div>
            <select
              value={privacyPhoto}
              onChange={e => { setPrivacyPhoto(e.target.value); saveField('privacy_profile_photo', e.target.value) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="everyone">Everyone</option>
              <option value="contacts">Contacts</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon"><UserX size={16} /></div>
              <div>
                <div className="settings-row-label">Blocked Users</div>
                <div className="settings-row-sub">Manage blocked contacts</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {/* Encryption */}
        <div className="settings-section">
          <div className="settings-section-title">Encryption</div>
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: encryptionStatus === 'ready' ? 'var(--online)' : 'var(--warning)' }}>
                {encryptionStatus === 'ready' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div>
                <div className="settings-row-label">
                  {encryptionStatus === 'ready' ? 'End-to-end encryption active' : 'Encryption key missing on this device'}
                </div>
                <div className="settings-row-sub">
                  {encryptionStatus === 'ready'
                    ? 'Your messages and files are encrypted before they leave this device.'
                    : 'You won\'t be able to read old encrypted chats here. Reset below to start fresh on this device.'}
                </div>
              </div>
            </div>
          </div>
          {encryptionStatus === 'ready' && profile?.public_key && (
            <div className="settings-row" style={{ cursor: 'default' }}>
              <div className="settings-row-left">
                <div className="settings-row-icon"><KeyRound size={16} /></div>
                <div>
                  <div className="settings-row-label">Your security code</div>
                  <div className="settings-row-sub" style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>{fingerprint(profile.public_key)}</div>
                </div>
              </div>
            </div>
          )}
          {encryptionStatus === 'missing-local-key' && (
            <div className="settings-row" onClick={async () => { if (resetting) return; setResetting(true); await resetEncryptionKeys(); setResetting(false) }}>
              <div className="settings-row-left">
                <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><KeyRound size={16} /></div>
                <div>
                  <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Reset encryption keys</div>
                  <div className="settings-row-sub">Generates a new key on this device. Old chat history stays unreadable.</div>
                </div>
              </div>
              {resetting && <div className="spinner" style={{ width: 16, height: 16 }} />}
            </div>
          )}
        </div>

        {/* Account */}
        <div className="settings-section">
          <div className="settings-section-title">Account</div>
          <div className="settings-row" onClick={signOut}>
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><LogOut size={16} /></div>
              <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Log Out</div>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-icon" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></div>
              <div>
                <div className="settings-row-label" style={{ color: 'var(--danger)' }}>Delete Account</div>
                <div className="settings-row-sub">Permanently delete your account and data</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '20px' }}>
          WaveChat v1.0.0 · Made with ❤️
        </div>
      </div>
    </div>
  )
}
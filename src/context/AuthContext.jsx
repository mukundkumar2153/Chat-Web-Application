import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  generateIdentityKeyPair, storePrivateKey, getPrivateKey, hasPrivateKey,
} from '../lib/crypto'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // 'ready' | 'missing-local-key' | null (unknown yet)
  const [encryptionStatus, setEncryptionStatus] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setEncryptionStatus(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    await ensureEncryptionKeys(userId, data)
    setLoading(false)
  }

  /**
   * Make sure this device has a usable encryption identity:
   * - No public key on profile yet -> generate keypair, save private key
   *   locally, push public key to the server.
   * - Public key exists but this device has no matching private key
   *   (new device / cleared storage) -> flag it; we never silently
   *   overwrite an existing public key, since that would orphan every
   *   conversation key already wrapped for the old one.
   */
  async function ensureEncryptionKeys(userId, profileData) {
    if (!profileData) return
    if (!profileData.public_key) {
      const { publicKey, secretKey } = generateIdentityKeyPair()
      storePrivateKey(userId, secretKey)
      const { error } = await supabase.from('profiles').update({ public_key: publicKey }).eq('id', userId)
      if (!error) {
        setProfile(prev => prev ? { ...prev, public_key: publicKey } : prev)
        setEncryptionStatus('ready')
      }
    } else if (hasPrivateKey(userId)) {
      setEncryptionStatus('ready')
    } else {
      // No local private key on this device — auto-generate a fresh keypair
      // instead of showing an error. Old encrypted messages on other devices
      // become unreadable on THIS device, but chat keeps working going forward.
      const { publicKey, secretKey } = generateIdentityKeyPair()
      storePrivateKey(userId, secretKey)
      const { error } = await supabase.from('profiles').update({ public_key: publicKey }).eq('id', userId)
      if (!error) {
        setProfile(prev => prev ? { ...prev, public_key: publicKey } : prev)
        setEncryptionStatus('ready')
      }
    }

  /**
   * Deliberate reset: wipes the old public key and generates a fresh
   * keypair on THIS device. Old conversation keys (wrapped for the old
   * public key) become unreadable — this is the tradeoff of not having
   * a key-migration protocol. Use only when truly locked out.
   */
  async function resetEncryptionKeys() {
    if (!user) return
    const { publicKey, secretKey } = generateIdentityKeyPair()
    storePrivateKey(user.id, secretKey)
    const { error } = await supabase.from('profiles').update({ public_key: publicKey }).eq('id', user.id)
    if (!error) {
      setProfile(prev => prev ? { ...prev, public_key: publicKey } : prev)
      setEncryptionStatus('ready')
    }
    return { error }
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (!error) setProfile(data)
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, updateProfile, signOut,
      fetchProfile: () => fetchProfile(user?.id),
      encryptionStatus,
      resetEncryptionKeys,
      myPrivateKey: user ? getPrivateKey(user.id) : null,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
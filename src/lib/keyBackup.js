import { supabase } from './supabase'
import { getPrivateKey, storePrivateKey } from './crypto'

// BIP39 standard 2048-word English list (truncated subset of 128 easy distinct words for zero-dependency lightness)
const WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
  'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert', 'alien',
  'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter', 'always',
  'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle',
  'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety',
  'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic', 'area',
  'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest', 'arrive',
  'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist',
  'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit',
  'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware'
]

/**
 * Generate a 12-word recovery passphrase using cryptographically secure random numbers
 */
export function generateMnemonicPassphrase() {
  const words = []
  const randomBytes = new Uint8Array(12)
  window.crypto.getRandomValues(randomBytes)
  for (let i = 0; i < 12; i++) {
    const index = randomBytes[i] % WORDLIST.length
    words.push(WORDLIST[index])
  }
  return words.join(' ')
}

// Convert Uint8Array <-> Base64
function uint8ToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Derive WebCrypto AES-GCM Key from passphrase string + salt using PBKDF2 (100,000 iterations)
 */
async function deriveKeyFromPassphrase(passphrase, saltBytes) {
  const enc = new TextEncoder()
  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.trim().toLowerCase()),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt private key string using Passphrase (PBKDF2 + AES-256-GCM)
 */
export async function encryptPrivateKeyWithPassphrase(privateKeyBase64, passphrase) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKeyFromPassphrase(passphrase, salt)

  const enc = new TextEncoder()
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKeyBase64)
  )

  return {
    encrypted_private_key: uint8ToBase64(new Uint8Array(ciphertext)),
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
  }
}

/**
 * Decrypt private key string using Passphrase (PBKDF2 + AES-256-GCM)
 */
export async function decryptPrivateKeyWithPassphrase(encryptedPrivateKeyBase64, saltBase64, ivBase64, passphrase) {
  try {
    const salt = base64ToUint8(saltBase64)
    const iv = base64ToUint8(ivBase64)
    const ciphertext = base64ToUint8(encryptedPrivateKeyBase64)
    const key = await deriveKeyFromPassphrase(passphrase, salt)

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    const dec = new TextDecoder()
    return dec.decode(decryptedBuffer)
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted backup')
  }
}

/**
 * Save user's encrypted private key backup to Supabase
 */
export async function saveKeyBackupToSupabase(userId, passphrase) {
  const privateKey = getPrivateKey(userId)
  if (!privateKey) throw new Error('No local private key found on this device')

  const { encrypted_private_key, salt, iv } = await encryptPrivateKeyWithPassphrase(privateKey, passphrase)

  const { data, error } = await supabase
    .from('encrypted_key_backups')
    .upsert({
      user_id: userId,
      encrypted_private_key,
      salt,
      iv,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch user's key backup from Supabase
 */
export async function fetchKeyBackupFromSupabase(userId) {
  const { data, error } = await supabase
    .from('encrypted_key_backups')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Restore private key on a new device using Passphrase
 */
export async function restorePrivateKeyFromBackup(userId, passphrase) {
  const backup = await fetchKeyBackupFromSupabase(userId)
  if (!backup) throw new Error('No key backup found for this account')

  const privateKey = await decryptPrivateKeyWithPassphrase(
    backup.encrypted_private_key,
    backup.salt,
    backup.iv,
    passphrase
  )

  // Store in localStorage for WaveChat TweetNaCl usage
  storePrivateKey(userId, privateKey)
  return privateKey
}

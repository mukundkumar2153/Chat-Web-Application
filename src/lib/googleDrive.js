import { encryptPrivateKeyWithPassphrase, decryptPrivateKeyWithPassphrase } from './keyBackup'

const GOOGLE_CLIENT_ID_KEY = 'wavechat_gdrive_client_id'
const GOOGLE_TOKEN_KEY = 'wavechat_gdrive_token'

export function getStoredGoogleClientId() {
  return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function saveGoogleClientId(clientId) {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId)
}

/**
 * Trigger Google OAuth 2.0 Token Popup for Drive AppData scope
 */
export function authenticateGoogleDrive({ clientId, onSuccess, onError }) {
  const targetClientId = clientId || getStoredGoogleClientId()
  if (!targetClientId) {
    onError?.(new Error('Google OAuth Client ID is required. Please set it in Settings -> Chats.'))
    return
  }

  saveGoogleClientId(targetClientId)

  const redirectUri = window.location.origin
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.appdata')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${targetClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=consent`

  const popup = window.open(authUrl, 'google_auth_popup', 'width=500,height=600')
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    onError?.(new Error('Popup blocked by browser. Please allow popups for this site and try again.'))
    return
  }

  const timer = setInterval(() => {
    try {
      if (!popup || popup.closed) {
        clearInterval(timer)
        return
      }
      const popupUrl = popup.location.href
      if (popupUrl && popupUrl.includes('access_token=')) {
        clearInterval(timer)
        const params = new URLSearchParams(popupUrl.split('#')[1])
        const accessToken = params.get('access_token')
        const expiresIn = params.get('expires_in')
        popup.close()

        if (accessToken) {
          const authData = {
            token: accessToken,
            expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
          }
          localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(authData))
          onSuccess?.(authData)
        } else {
          onError?.(new Error('Failed to obtain Google access token'))
        }
      }
    } catch {
      // Cross-origin check throws until redirect happens back to same origin
    }
  }, 500)
}

export function getGoogleAccessToken() {
  try {
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(GOOGLE_TOKEN_KEY)
      return null
    }
    return parsed.token
  } catch {
    return null
  }
}

/**
 * Search for existing wavechat_backup.enc file in Google Drive AppData folder
 */
export async function findDriveBackupFile(accessToken) {
  const token = accessToken || getGoogleAccessToken()
  if (!token) throw new Error('Not connected to Google Drive')

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='wavechat_backup.enc'&fields=files(id,name,size,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Failed to check Google Drive AppData folder')
  }

  const data = await res.json()
  return data.files?.[0] || null
}

/**
 * Export messages to encrypted file and upload to Google Drive AppData folder
 */
export async function uploadChatBackupToDrive({ messagesData, passphrase, onProgress }) {
  const token = getGoogleAccessToken()
  if (!token) throw new Error('Please connect your Google Drive account first')

  onProgress?.('Encrypting chat database...')
  const jsonPayload = JSON.stringify({
    version: 1,
    exported_at: new Date().toISOString(),
    chats: messagesData || [],
  })

  // Encrypt the chat JSON using PBKDF2/AES-GCM with passphrase
  const encryptedObj = await encryptPrivateKeyWithPassphrase(jsonPayload, passphrase)
  const fileContent = JSON.stringify(encryptedObj)

  onProgress?.('Checking existing cloud backups...')
  const existingFile = await findDriveBackupFile(token)

  const metadata = {
    name: 'wavechat_backup.enc',
    parents: existingFile ? [] : ['appDataFolder'],
    mimeType: 'application/json',
  }

  const formData = new FormData()
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.append('file', new Blob([fileContent], { type: 'application/json' }))

  onProgress?.('Uploading to Google Drive AppData...')
  const uploadUrl = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder`

  const res = await fetch(uploadUrl, {
    method: existingFile ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Failed to upload backup to Google Drive')
  }

  const uploaded = await res.json()
  onProgress?.('Backup uploaded successfully!')
  return uploaded
}

/**
 * Download and decrypt chat backup file from Google Drive AppData
 */
export async function downloadChatBackupFromDrive({ passphrase, onProgress }) {
  const token = getGoogleAccessToken()
  if (!token) throw new Error('Please connect your Google Drive account first')

  onProgress?.('Searching for backup in Google Drive...')
  const backupFile = await findDriveBackupFile(token)
  if (!backupFile) throw new Error('No WaveChat backup found in your Google Drive')

  onProgress?.('Downloading cloud backup...')
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${backupFile.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Failed to download backup file from Google Drive')

  const fileContentText = await res.text()
  let encryptedObj
  try {
    encryptedObj = JSON.parse(fileContentText)
  } catch {
    throw new Error('Corrupted cloud backup file format')
  }

  onProgress?.('Decrypting backup with recovery passphrase...')
  const decryptedJson = await decryptPrivateKeyWithPassphrase(
    encryptedObj.encrypted_private_key,
    encryptedObj.salt,
    encryptedObj.iv,
    passphrase
  )

  const backupData = JSON.parse(decryptedJson)
  onProgress?.('Cloud backup restored successfully!')
  return backupData
}

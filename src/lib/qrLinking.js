import { supabase } from './supabase'
import { getPrivateKey, storePrivateKey, generateIdentityKeyPair, wrapKeyForMember, unwrapKeyForMe } from './crypto'

/**
 * Primary device starts a QR linking session.
 * Subscribes to a temporary realtime channel and listens for incoming pairing requests.
 */
export function startPrimaryQRSession({ user, onDeviceRequest, onDeviceLinked }) {
  const sessionId = `qr_${user.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const primarySecretKey = getPrivateKey(user.id)

  const channel = supabase.channel(`qr-link:${sessionId}`)

  channel
    .on('broadcast', { event: 'request-link' }, async (payload) => {
      const { secondaryPublicKey, deviceName, deviceId } = payload.payload || {}
      if (!secondaryPublicKey || !primarySecretKey) return

      onDeviceRequest?.({ deviceName, deviceId })

      // Device-to-device encrypted key transfer:
      // Encrypt primary device's private key for secondary device's public key
      const { encrypted_key, nonce } = wrapKeyForMember({
        conversationKeyBytes: new TextEncoder().encode(primarySecretKey),
        recipientPublicKeyBase64: secondaryPublicKey,
        mySecretKeyBase64: primarySecretKey,
      })

      // Send encrypted key back to secondary device
      await channel.send({
        type: 'broadcast',
        event: 'approve-link',
        payload: {
          encryptedPrivateKey: encrypted_key,
          nonce,
          primaryPublicKey: user.public_key || payload.payload.primaryPublicKey,
        },
      })

      // Save to linked_devices table in Supabase
      try {
        await supabase.from('linked_devices').upsert({
          user_id: user.id,
          device_id: deviceId || `dev_${Date.now()}`,
          device_name: deviceName || 'Web Browser',
          public_key: secondaryPublicKey,
          linked_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        })
      } catch (err) {
        console.error('Error recording linked device:', err)
      }

      onDeviceLinked?.({ deviceName, deviceId })
    })
    .subscribe()

  return {
    sessionId,
    qrData: JSON.stringify({
      sessionId,
      userId: user.id,
      displayName: user.user_metadata?.display_name || user.email || 'WaveChat User',
    }),
    cleanup: () => supabase.removeChannel(channel),
  }
}

/**
 * Secondary device scans QR code and requests private key transfer.
 */
export function scanAndConnectDevice({ qrDataString, deviceName, onSuccess, onError }) {
  let parsed
  try {
    parsed = typeof qrDataString === 'string' ? JSON.parse(qrDataString) : qrDataString
  } catch {
    onError?.(new Error('Invalid QR code scanned'))
    return
  }

  const { sessionId, userId } = parsed
  if (!sessionId || !userId) {
    onError?.(new Error('Invalid WaveChat QR payload'))
    return
  }

  // Generate temporary keypair for secure transport
  const tempKeypair = generateIdentityKeyPair()
  const deviceId = `dev_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  const channel = supabase.channel(`qr-link:${sessionId}`)

  channel
    .on('broadcast', { event: 'approve-link' }, (payload) => {
      const { encryptedPrivateKey, nonce, primaryPublicKey } = payload.payload || {}
      if (!encryptedPrivateKey || !nonce) {
        onError?.(new Error('Failed to receive encrypted credentials'))
        return
      }

      try {
        // Decrypt the transferred private key using secondary device's temp keypair
        const decryptedBytes = unwrapKeyForMe({
          encryptedKeyBase64: encryptedPrivateKey,
          nonceBase64: nonce,
          senderPublicKeyBase64: tempKeypair.publicKey,
          mySecretKeyBase64: tempKeypair.secretKey,
        })

        if (!decryptedBytes) {
          throw new Error('Key decryption failed during device pairing')
        }

        const privateKeyStr = new TextDecoder().decode(decryptedBytes)
        storePrivateKey(userId, privateKeyStr)

        supabase.removeChannel(channel)
        onSuccess?.({ userId, privateKey: privateKeyStr })
      } catch (err) {
        onError?.(err)
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Send request to primary device
        await channel.send({
          type: 'broadcast',
          event: 'request-link',
          payload: {
            secondaryPublicKey: tempKeypair.publicKey,
            deviceName: deviceName || navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser',
            deviceId,
          },
        })
      }
    })

  return () => supabase.removeChannel(channel)
}

/**
 * Fetch list of linked devices for user
 */
export async function fetchLinkedDevices(userId) {
  const { data, error } = await supabase
    .from('linked_devices')
    .select('*')
    .eq('user_id', userId)
    .order('linked_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Revoke / Unlink a device
 */
export async function revokeLinkedDevice(userId, deviceId) {
  const { error } = await supabase
    .from('linked_devices')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId)

  if (error) throw error
}

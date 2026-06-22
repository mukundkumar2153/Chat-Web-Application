import { supabase } from './supabase'
import {
  generateConversationKey, wrapKeyForMember, unwrapKeyForMe,
  cacheConversationKey, getCachedConversationKey, getPrivateKey,
} from './crypto'

/**
 * Create a brand new conversation key and wrap it for every member
 * (including the creator). Call this ONCE right after a conversation
 * + its members have been inserted.
 */
export async function createAndDistributeConversationKey({ conversationId, memberUserIds, myUserId }) {
  const mySecretKey = getPrivateKey(myUserId)
  if (!mySecretKey) throw new Error('Missing local encryption key — cannot create secure conversation')

  const keyBytes = generateConversationKey()

  // Fetch public keys for all members (including self)
  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, public_key')
    .in('id', memberUserIds)
  if (error) throw error

  const rows = []
  for (const m of members) {
    if (!m.public_key) continue // member hasn't set up encryption yet — skip, they'll see "encryption not ready"
    const { encrypted_key, nonce } = wrapKeyForMember({
      conversationKeyBytes: keyBytes,
      recipientPublicKeyBase64: m.public_key,
      mySecretKeyBase64: mySecretKey,
    })
    rows.push({
      conversation_id: conversationId,
      user_id: m.id,
      wrapped_by: myUserId,
      encrypted_key,
      nonce,
    })
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from('conversation_keys').insert(rows)
    if (insErr) throw insErr
  }

  cacheConversationKey(conversationId, keyBytes)
  return keyBytes
}

/**
 * Get the symmetric key for a conversation, unwrapping it the first time
 * and caching it in memory afterwards.
 */
export async function getConversationKey({ conversationId, myUserId }) {
  const cached = getCachedConversationKey(conversationId)
  if (cached) return cached

  const mySecretKey = getPrivateKey(myUserId)
  if (!mySecretKey) return null

  const { data: row } = await supabase
    .from('conversation_keys')
    .select('encrypted_key, nonce, wrapped_by, profiles:wrapped_by (public_key)')
    .eq('conversation_id', conversationId)
    .eq('user_id', myUserId)
    .maybeSingle()

  if (!row || !row.profiles?.public_key) return null

  const keyBytes = unwrapKeyForMe({
    encryptedKeyBase64: row.encrypted_key,
    nonceBase64: row.nonce,
    senderPublicKeyBase64: row.profiles.public_key,
    mySecretKeyBase64: mySecretKey,
  })
  if (!keyBytes) return null

  cacheConversationKey(conversationId, keyBytes)
  return keyBytes
}

/**
 * When a new member joins a group, wrap the EXISTING conversation key
 * for them too (requires the inviter to already have the key cached/unwrapped).
 */
export async function shareKeyWithNewMember({ conversationId, newMemberUserId, myUserId }) {
  const keyBytes = await getConversationKey({ conversationId, myUserId })
  if (!keyBytes) throw new Error('You do not have the conversation key cached — reopen the chat first')

  const mySecretKey = getPrivateKey(myUserId)
  const { data: member } = await supabase
    .from('profiles')
    .select('id, public_key')
    .eq('id', newMemberUserId)
    .single()
  if (!member?.public_key) throw new Error('That user has not set up encryption yet')

  const { encrypted_key, nonce } = wrapKeyForMember({
    conversationKeyBytes: keyBytes,
    recipientPublicKeyBase64: member.public_key,
    mySecretKeyBase64: mySecretKey,
  })

  await supabase.from('conversation_keys').insert({
    conversation_id: conversationId,
    user_id: newMemberUserId,
    wrapped_by: myUserId,
    encrypted_key,
    nonce,
  })
}

export async function memberHasEncryptionSetUp(userId) {
  const { data } = await supabase.from('profiles').select('public_key').eq('id', userId).single()
  return !!data?.public_key
}
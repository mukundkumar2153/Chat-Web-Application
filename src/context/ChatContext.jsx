import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { encryptText, decryptText } from '../lib/crypto'
import { getConversationKey, syncMissingMemberKeys } from '../lib/encryption'
import { encryptAndUploadFile } from '../lib/media'

const ChatContext = createContext({})

// Fallback shown when we genuinely can't decrypt (key missing, wrong key, etc.)
const UNDECRYPTABLE = '🔒 Unable to decrypt this message'

export function ChatProvider({ children }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [loadingConvos, setLoadingConvos] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [typingUsers, setTypingUsers] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null) // { fileName, percent } | null

  const activeConvRef = useRef(null)
  useEffect(() => { activeConvRef.current = activeConversation }, [activeConversation])

  const conversationIdsRef = useRef(new Set())
  useEffect(() => { conversationIdsRef.current = new Set(conversations.map(c => c.id)) }, [conversations])

  // ---------- decryption helpers ----------

  const decryptMessageRow = useCallback(async (row, conversationId) => {
    const key = await getConversationKey({ conversationId, myUserId: user.id })
    if (!key) return { ...row, content: UNDECRYPTABLE, thumbnail_data_url: null, _decryptFailed: true }

    const content = row.content && row.nonce
      ? (decryptText(row.content, row.nonce, key) ?? UNDECRYPTABLE)
      : row.content

    let thumbnail_data_url = null
    if (row.thumbnail_ciphertext && row.thumbnail_nonce) {
      thumbnail_data_url = decryptText(row.thumbnail_ciphertext, row.thumbnail_nonce, key)
    }

    let reply_to = row.reply_to
    if (reply_to?.content && reply_to?.nonce) {
      reply_to = { ...reply_to, content: decryptText(reply_to.content, reply_to.nonce, key) ?? UNDECRYPTABLE }
    }

    return { ...row, content, thumbnail_data_url, reply_to }
  }, [user])

  // ---------- conversations ----------

  const fetchConversations = useCallback(async () => {
    if (!user) return
    setLoadingConvos(true)
    const { data } = await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        pinned,
        last_read_at,
        conversations (
          id, name, is_group, group_avatar_url, created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { foreignTable: 'conversations', ascending: false })

    if (data) {
      const enriched = await Promise.all(data.map(async (cm) => {
        const conv = cm.conversations
        if (!conv) return null
        if (!conv.is_group) {
          const { data: otherMember } = await supabase
            .from('conversation_members')
            .select('profiles:user_id (id, display_name, avatar_url, status_text, last_seen, is_online, public_key)')
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id)
            .maybeSingle()
          conv.other_user = otherMember?.profiles || null
        }

        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .gt('created_at', cm.last_read_at || '1970-01-01')
          .neq('sender_id', user.id)

        const { data: lastMsgRaw } = await supabase
          .from('messages')
          .select('content, nonce, message_type, created_at, sender_id, deleted_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let lastMsg = lastMsgRaw
        if (lastMsgRaw && !lastMsgRaw.deleted_at) {
          const key = await getConversationKey({ conversationId: conv.id, myUserId: user.id })
          if (key && lastMsgRaw.content && lastMsgRaw.nonce) {
            lastMsg = { ...lastMsgRaw, content: decryptText(lastMsgRaw.content, lastMsgRaw.nonce, key) ?? UNDECRYPTABLE }
          }
        }

        return {
          ...conv,
          pinned: cm.pinned,
          unread_count: count || 0,
          last_message: lastMsg || null,
        }
      }))

      const cleaned = enriched.filter(Boolean)
      setConversations(cleaned.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        const aTime = a.last_message?.created_at || a.created_at
        const bTime = b.last_message?.created_at || b.created_at
        return new Date(bTime) - new Date(aTime)
      }))
    }
    setLoadingConvos(false)
  }, [user])

  // ---------- messages ----------

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return
    setLoadingMessages(true)

    const { data: memberRow } = await supabase
      .from('conversation_members')
      .select('cleared_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    let query = supabase
      .from('messages')
      .select(`
        *,
        profiles:sender_id (id, display_name, avatar_url),
        reply_to:reply_to_id (
          id, content, nonce, message_type,
          profiles:sender_id (display_name)
        ),
        message_reactions (
          id, emoji, user_id,
          profiles:user_id (display_name)
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (memberRow?.cleared_at) query = query.gt('created_at', memberRow.cleared_at)

    const { data } = await query

    const decrypted = await Promise.all((data || []).map(row => decryptMessageRow(row, conversationId)))
    setMessages(decrypted)
    setLoadingMessages(false)

    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
  }, [user, decryptMessageRow])

  // ---------- send text ----------

  const sendMessage = useCallback(async ({ conversationId, content, type = 'text', replyToId = null }) => {
    const key = await getConversationKey({ conversationId, myUserId: user.id })
    if (!key) return { error: new Error('Encryption key unavailable for this conversation') }

    syncMissingMemberKeys({ conversationId, myUserId: user.id }) // catch-up for members who set up encryption later

    const { ciphertext, nonce } = encryptText(content, key)

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: ciphertext,
        nonce,
        message_type: type,
        reply_to_id: replyToId,
      })
      .select(`
        *,
        profiles:sender_id (id, display_name, avatar_url),
        reply_to:reply_to_id (
          id, content, nonce, message_type,
          profiles:sender_id (display_name)
        ),
        message_reactions (id, emoji, user_id)
      `)
      .single()

    if (!error && data) {
      const decrypted = await decryptMessageRow(data, conversationId)
      setMessages(prev => [...prev, decrypted])
    }
    return { data, error }
  }, [user, decryptMessageRow])

  // ---------- send media (image / video / document / voice) ----------

  const sendMediaMessage = useCallback(async ({ conversationId, file, replyToId = null }) => {
    const key = await getConversationKey({ conversationId, myUserId: user.id })
    if (!key) return { error: new Error('Encryption key unavailable for this conversation') }

    setUploadProgress({ fileName: file.name, percent: 10 })
    let meta
    try {
      meta = await encryptAndUploadFile({
        file, conversationId, conversationKeyBytes: key,
        onProgress: (p) => setUploadProgress({ fileName: file.name, percent: p }),
      })
    } catch (err) {
      setUploadProgress(null)
      return { error: err }
    }

    const { ciphertext, nonce } = encryptText(meta.file_name, key)
    let thumbnail_ciphertext = null, thumbnail_nonce = null
    if (meta.thumbnail_data_url) {
      const enc = encryptText(meta.thumbnail_data_url, key)
      thumbnail_ciphertext = enc.ciphertext
      thumbnail_nonce = enc.nonce
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: ciphertext,
        nonce,
        message_type: meta.message_type,
        storage_path: meta.storage_path,
        file_nonce: meta.file_nonce,
        file_size: meta.file_size,
        mime_type: meta.mime_type,
        thumbnail_ciphertext,
        thumbnail_nonce,
        reply_to_id: replyToId,
      })
      .select(`
        *,
        profiles:sender_id (id, display_name, avatar_url),
        reply_to:reply_to_id (id, content, nonce, message_type, profiles:sender_id (display_name)),
        message_reactions (id, emoji, user_id)
      `)
      .single()

    setUploadProgress(null)

    if (!error && data) {
      const decrypted = await decryptMessageRow(data, conversationId)
      setMessages(prev => [...prev, decrypted])
    }
    return { data, error }
  }, [user, decryptMessageRow])

  const deleteMessage = useCallback(async (messageId) => {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId)
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m))
  }, [])

  const reactToMessage = useCallback(async (messageId, emoji) => {
    const existing = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .single()

    if (existing.data) {
      await supabase.from('message_reactions').delete().eq('id', existing.data.id)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji })
    }
    fetchMessages(activeConvRef.current?.id)
  }, [user, fetchMessages])

  const togglePinConversation = useCallback(async (conversationId, pinned) => {
    await supabase
      .from('conversation_members')
      .update({ pinned: !pinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
    fetchConversations()
  }, [user, fetchConversations])

  const toggleStarMessage = useCallback(async (msg) => {
    const isStarred = (msg.starred_by || []).includes(user.id)
    const newArr = isStarred ? msg.starred_by.filter(id => id !== user.id) : [...(msg.starred_by || []), user.id]
    await supabase.from('messages').update({ starred_by: newArr }).eq('id', msg.id)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred_by: newArr } : m))
  }, [user])

  const markAllAsRead = useCallback(async () => {
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('user_id', user.id)
    fetchConversations()
  }, [user, fetchConversations])

  const deleteConversations = useCallback(async (conversationIds) => {
    await supabase.from('conversation_members').delete().eq('user_id', user.id).in('conversation_id', conversationIds)
    if (conversationIds.includes(activeConvRef.current?.id)) setActiveConversation(null)
    fetchConversations()
  }, [user, fetchConversations])

  // ---------- realtime ----------

  useEffect(() => {
    if (!user || !activeConversation) return

    const channel = supabase
      .channel(`messages:${activeConversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversation.id}`,
      }, async (payload) => {
        if (payload.new.sender_id === user.id) return
        const { data } = await supabase
          .from('messages')
          .select(`*, profiles:sender_id (id, display_name, avatar_url), reply_to:reply_to_id (id, content, nonce, profiles:sender_id (display_name)), message_reactions (id, emoji, user_id)`)
          .eq('id', payload.new.id)
          .single()
        if (data) {
          const decrypted = await decryptMessageRow(data, activeConversation.id)
          setMessages(prev => [...prev, decrypted])
        }
        fetchConversations()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversation.id}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, deleted_at: payload.new.deleted_at } : m))
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id === user.id) return
        setTypingUsers(prev => ({ ...prev, [payload.payload.user_id]: payload.payload.display_name }))
        setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[payload.payload.user_id]; return n })
        }, 3000)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, activeConversation, decryptMessageRow, fetchConversations])

  // ---------- global listener (updates sidebar even for chats not currently open) ----------

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('global-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const convId = payload.new.conversation_id
        if (!conversationIdsRef.current.has(convId)) return
        fetchConversations()
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}`,
      }, () => {
        // I was just added to a (new) conversation — pull it into the sidebar
        fetchConversations()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, fetchConversations])

  // ---------- presence ----------

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(new Set(Object.keys(state)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() })
        }
      })
    return () => supabase.removeChannel(channel)
  }, [user])

  const sendTypingIndicator = useCallback(async (conversationId, displayName) => {
    const channel = supabase.channel(`messages:${conversationId}`)
    await channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, display_name: displayName } })
  }, [user])

  useEffect(() => {
    if (user) fetchConversations()
  }, [user, fetchConversations])

  useEffect(() => {
    if (activeConversation) fetchMessages(activeConversation.id)
    else setMessages([])
  }, [activeConversation, fetchMessages])

  return (
    <ChatContext.Provider value={{
      conversations, setConversations,
      activeConversation, setActiveConversation,
      messages, setMessages,
      onlineUsers,
      loadingConvos, loadingMessages,
      typingUsers,
      searchQuery, setSearchQuery,
      uploadProgress,
      fetchConversations,
      fetchMessages,
      sendMessage,
      sendMediaMessage,
      deleteMessage,
      reactToMessage,
      togglePinConversation,
      toggleStarMessage,
      markAllAsRead,
      deleteConversations,
      sendTypingIndicator,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => useContext(ChatContext)
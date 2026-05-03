import { useState, useEffect, useCallback, useRef } from "react"

import { getBackend, isUsingMockBackend } from "../services/backend"
import type { BroadcastChannel, RealtimeChannel } from "../services/backend/types"
import type { RealtimeMessage, TypingState } from "../types/realtime"
import { logger } from "../utils/Logger"

/** Simplified payload type for internal handlers */
interface MessagePayload {
  new: RealtimeMessage | null
  old: RealtimeMessage | null
}

export interface UseRealtimeMessagesOptions {
  /** Channel ID to subscribe to */
  channelId: string
  /** Whether to include user info with messages */
  includeUser?: boolean
  /** Initial messages to display (e.g., from cache or server) */
  initialMessages?: RealtimeMessage[]
  /** Maximum number of messages to keep in state */
  maxMessages?: number
  /** Called when a new message is received */
  onNewMessage?: (message: RealtimeMessage) => void
  /** Called when a message is updated */
  onMessageUpdated?: (message: RealtimeMessage) => void
  /** Called when a message is deleted */
  onMessageDeleted?: (messageId: string) => void
  /** Called when typing state changes */
  onTypingChange?: (typingUsers: string[]) => void
}

export interface UseRealtimeMessagesReturn {
  /** Current messages in the channel */
  messages: RealtimeMessage[]
  /** Loading state */
  loading: boolean
  /** Error state */
  error: Error | null
  /** Whether the subscription is connected */
  isConnected: boolean
  /** Users currently typing */
  typingUsers: string[]
  /** Send a new message */
  sendMessage: (
    content: string,
    metadata?: Record<string, unknown>,
  ) => Promise<{ error: Error | null }>
  /** Update an existing message */
  updateMessage: (messageId: string, content: string) => Promise<{ error: Error | null }>
  /** Delete a message */
  deleteMessage: (messageId: string) => Promise<{ error: Error | null }>
  /** Broadcast typing state */
  setTyping: (isTyping: boolean) => void
  /** Manually refresh messages from server */
  refresh: () => Promise<void>
}

/**
 * Hook for real-time chat messages with typing indicators
 *
 * Uses the backend abstraction layer for provider-agnostic realtime functionality.
 *
 * @example
 * ```tsx
 * function ChatRoom({ channelId }: { channelId: string }) {
 *   const {
 *     messages,
 *     sendMessage,
 *     typingUsers,
 *     setTyping,
 *     isConnected,
 *   } = useRealtimeMessages({
 *     channelId,
 *     onNewMessage: (msg) => playNotificationSound(),
 *   })
 *
 *   const handleSend = async (text: string) => {
 *     const { error } = await sendMessage(text)
 *     if (error) alert(error.message)
 *   }
 *
 *   return (
 *     <View>
 *       {!isConnected && <Text>Connecting...</Text>}
 *       <FlatList data={messages} renderItem={({ item }) => <Message {...item} />} />
 *       {typingUsers.length > 0 && <Text>{typingUsers.join(', ')} typing...</Text>}
 *       <ChatInput onSend={handleSend} onTyping={setTyping} />
 *     </View>
 *   )
 * }
 * ```
 */
export function useRealtimeMessages(
  options: UseRealtimeMessagesOptions,
): UseRealtimeMessagesReturn {
  const {
    channelId,
    includeUser = false,
    initialMessages = [],
    maxMessages = 100,
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTypingChange,
  } = options

  const [messages, setMessages] = useState<RealtimeMessage[]>(initialMessages)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const tableChannelRef = useRef<RealtimeChannel | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const currentUserIdRef = useRef<string | null>(null)

  // Fetch initial messages using the database service
  const fetchMessages = useCallback(async () => {
    if (isUsingMockBackend()) {
      setLoading(false)
      setIsConnected(true)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const backend = getBackend()

      // Build select string based on includeUser option
      const selectFields = includeUser
        ? "*, user:profiles(id, first_name, last_name, avatar_url)"
        : "*"

      const { data, error: fetchError } = await backend.db.query<RealtimeMessage>("messages", {
        filters: [{ column: "channel_id", operator: "eq", value: channelId }],
        orderBy: [{ column: "created_at", ascending: true }],
        limit: maxMessages,
        select: selectFields,
      })

      if (fetchError) {
        throw fetchError
      }

      setMessages(data ?? [])
    } catch (err) {
      const resolvedError = err instanceof Error ? err : new Error(String(err))
      logger.error("[useRealtimeMessages] Failed to fetch messages", { channelId }, resolvedError)
      setError(resolvedError)
    } finally {
      setLoading(false)
    }
  }, [channelId, includeUser, maxMessages])

  // Handle new message from realtime
  const handleInsert = useCallback(
    (payload: MessagePayload) => {
      if (!payload.new) return

      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === payload.new!.id)) {
          return prev
        }

        const newMessages = [...prev, payload.new!]
        // Trim to max messages
        if (newMessages.length > maxMessages) {
          return newMessages.slice(-maxMessages)
        }
        return newMessages
      })

      onNewMessage?.(payload.new)
    },
    [maxMessages, onNewMessage],
  )

  // Handle message update from realtime
  const handleUpdate = useCallback(
    (payload: MessagePayload) => {
      if (!payload.new) return

      setMessages((prev) => prev.map((m) => (m.id === payload.new!.id ? payload.new! : m)))

      onMessageUpdated?.(payload.new)
    },
    [onMessageUpdated],
  )

  // Handle message deletion from realtime
  const handleDelete = useCallback(
    (payload: MessagePayload) => {
      if (!payload.old?.id) return

      setMessages((prev) => prev.filter((m) => m.id !== payload.old!.id))

      onMessageDeleted?.(payload.old.id)
    },
    [onMessageDeleted],
  )

  // Handle typing broadcast
  const handleTyping = useCallback(
    (payload: Record<string, unknown>) => {
      const typingPayload = payload as unknown as TypingState
      const { user_id, is_typing } = typingPayload

      // Clear existing timeout for this user
      const existingTimeout = typingTimeoutsRef.current.get(user_id)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        typingTimeoutsRef.current.delete(user_id)
      }

      setTypingUsers((prev) => {
        if (is_typing) {
          // Add user if not already typing
          if (!prev.includes(user_id)) {
            const newTyping = [...prev, user_id]
            onTypingChange?.(newTyping)
            return newTyping
          }
        } else {
          // Remove user from typing
          const newTyping = prev.filter((id) => id !== user_id)
          onTypingChange?.(newTyping)
          return newTyping
        }
        return prev
      })

      // Auto-clear typing after 5 seconds
      if (is_typing) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const newTyping = prev.filter((id) => id !== user_id)
            onTypingChange?.(newTyping)
            return newTyping
          })
          typingTimeoutsRef.current.delete(user_id)
        }, 5000)
        typingTimeoutsRef.current.set(user_id, timeout)
      }
    },
    [onTypingChange],
  )

  // Set up realtime subscription
  useEffect(() => {
    if (isUsingMockBackend()) {
      setIsConnected(true)
      setLoading(false)
      return
    }

    const backend = getBackend()

    // Fetch initial messages
    fetchMessages()

    // Get current user for typing broadcasts
    backend.auth.getUser().then(({ data }) => {
      if (data?.user) {
        currentUserIdRef.current = data.user.id
      }
    })

    // Subscribe to INSERT events
    const insertChannel = backend.realtime.subscribeToTable<RealtimeMessage>(
      "messages",
      (payload) => {
        handleInsert({
          new: payload.new as RealtimeMessage | null,
          old: payload.old as RealtimeMessage | null,
        })
      },
      {
        event: "INSERT",
        filter: `channel_id=eq.${channelId}`,
      },
    )

    // Subscribe to UPDATE events
    const updateChannel = backend.realtime.subscribeToTable<RealtimeMessage>(
      "messages",
      (payload) => {
        handleUpdate({
          new: payload.new as RealtimeMessage | null,
          old: payload.old as RealtimeMessage | null,
        })
      },
      {
        event: "UPDATE",
        filter: `channel_id=eq.${channelId}`,
      },
    )

    // Subscribe to DELETE events
    const deleteChannel = backend.realtime.subscribeToTable<RealtimeMessage>(
      "messages",
      (payload) => {
        handleDelete({
          new: payload.new as RealtimeMessage | null,
          old: payload.old as RealtimeMessage | null,
        })
      },
      {
        event: "DELETE",
        filter: `channel_id=eq.${channelId}`,
      },
    )

    // Create broadcast channel for typing indicators
    const broadcastChannel = backend.realtime.createBroadcastChannel(`messages:${channelId}:typing`)
    broadcastChannel.onBroadcast("typing", handleTyping)

    // Subscribe to all channels
    let subscribedCount = 0
    const checkAllSubscribed = () => {
      subscribedCount++
      if (subscribedCount >= 4) {
        setIsConnected(true)
        logger.debug("[useRealtimeMessages] Subscribed to channel", { channelId })
      }
    }

    insertChannel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        checkAllSubscribed()
      } else if (status === "ERROR") {
        setIsConnected(false)
        setError(err ?? new Error("Failed to connect to realtime channel"))
        logger.error("[useRealtimeMessages] Channel error", { channelId })
      }
    })

    updateChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") checkAllSubscribed()
    })

    deleteChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") checkAllSubscribed()
    })

    broadcastChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") checkAllSubscribed()
    })

    tableChannelRef.current = insertChannel
    broadcastChannelRef.current = broadcastChannel

    return () => {
      // Clear typing timeouts - use ref directly to ensure we clear the current timeouts
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      typingTimeoutsRef.current.clear()

      // Unsubscribe from all channels
      insertChannel.unsubscribe()
      updateChannel.unsubscribe()
      deleteChannel.unsubscribe()
      broadcastChannel.unsubscribe()

      tableChannelRef.current = null
      broadcastChannelRef.current = null
      setIsConnected(false)
    }
  }, [channelId, fetchMessages, handleInsert, handleUpdate, handleDelete, handleTyping])

  // Send a new message
  const sendMessage = useCallback(
    async (content: string, metadata?: Record<string, unknown>) => {
      if (isUsingMockBackend()) {
        // Mock: add message locally
        const mockMessage: RealtimeMessage = {
          id: `mock-${Date.now()}`,
          channel_id: channelId,
          user_id: "mock-user",
          content,
          created_at: new Date().toISOString(),
          metadata,
        }
        setMessages((prev) => [...prev, mockMessage])
        onNewMessage?.(mockMessage)
        return { error: null }
      }

      try {
        const backend = getBackend()
        const { data: userData } = await backend.auth.getUser()

        if (!userData?.user) {
          return { error: new Error("Not authenticated") }
        }

        const { error: insertError } = await backend.db.insert("messages", {
          channel_id: channelId,
          user_id: userData.user.id,
          content,
          metadata,
        })

        if (insertError) {
          return { error: insertError }
        }

        return { error: null }
      } catch (err) {
        const resolvedError = err instanceof Error ? err : new Error(String(err))
        logger.error("[useRealtimeMessages] Failed to send message", { channelId }, resolvedError)
        return { error: resolvedError }
      }
    },
    [channelId, onNewMessage],
  )

  // Update an existing message
  const updateMessage = useCallback(async (messageId: string, content: string) => {
    if (isUsingMockBackend()) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content, updated_at: new Date().toISOString() } : m,
        ),
      )
      return { error: null }
    }

    try {
      const backend = getBackend()
      const { error: updateError } = await backend.db.update(
        "messages",
        { content, updated_at: new Date().toISOString() },
        [{ column: "id", operator: "eq", value: messageId }],
      )

      if (updateError) {
        return { error: updateError }
      }

      return { error: null }
    } catch (err) {
      const resolvedError = err instanceof Error ? err : new Error(String(err))
      logger.error("[useRealtimeMessages] Failed to update message", { messageId }, resolvedError)
      return { error: resolvedError }
    }
  }, [])

  // Delete a message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (isUsingMockBackend()) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        onMessageDeleted?.(messageId)
        return { error: null }
      }

      try {
        const backend = getBackend()
        const { error: deleteError } = await backend.db.delete("messages", [
          { column: "id", operator: "eq", value: messageId },
        ])

        if (deleteError) {
          return { error: deleteError }
        }

        return { error: null }
      } catch (err) {
        const resolvedError = err instanceof Error ? err : new Error(String(err))
        logger.error("[useRealtimeMessages] Failed to delete message", { messageId }, resolvedError)
        return { error: resolvedError }
      }
    },
    [onMessageDeleted],
  )

  // Broadcast typing state
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (isUsingMockBackend() || !broadcastChannelRef.current || !currentUserIdRef.current) return

      try {
        await broadcastChannelRef.current.send("typing", {
          user_id: currentUserIdRef.current,
          channel_id: channelId,
          is_typing: isTyping,
        } satisfies TypingState)
      } catch (err) {
        logger.error("[useRealtimeMessages] Failed to broadcast typing", {}, err as Error)
      }
    },
    [channelId],
  )

  // Refresh messages
  const refresh = useCallback(async () => {
    await fetchMessages()
  }, [fetchMessages])

  return {
    messages,
    loading,
    error,
    isConnected,
    typingUsers,
    sendMessage,
    updateMessage,
    deleteMessage,
    setTyping,
    refresh,
  }
}

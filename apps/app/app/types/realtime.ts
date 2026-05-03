/**
 * Supabase Realtime Types
 *
 * Types for real-time chat messages, activity feeds, and presence tracking.
 * Use these with the useRealtimeMessages, useRealtimePresence, and useRealtimeSubscription hooks.
 */

/**
 * Base message type for chat applications
 */
export interface RealtimeMessage {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
  /** Optional metadata for rich messages (images, links, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * Message with user info for display
 */
export interface RealtimeMessageWithUser extends RealtimeMessage {
  user: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
}

/**
 * Activity feed item for notifications/updates
 */
export interface RealtimeActivity {
  id: string
  user_id: string
  type: "comment" | "like" | "follow" | "mention" | "share" | "custom"
  target_id?: string
  target_type?: string
  content?: string
  created_at: string
  read: boolean
  metadata?: Record<string, unknown>
}

/**
 * Presence state for a user in a channel
 */
export interface PresenceState {
  user_id: string
  online_at: string
  status?: "online" | "away" | "busy" | "offline"
  /** Custom presence data (typing indicator, current screen, etc.) */
  custom?: Record<string, unknown>
}

/**
 * Typing indicator state
 */
export interface TypingState {
  user_id: string
  channel_id: string
  is_typing: boolean
}

/**
 * Realtime subscription event types
 */
export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*"

/**
 * Payload received from postgres_changes subscription
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeEventType
  new: T | null
  old: T | null
  schema: string
  table: string
  commit_timestamp: string
}

/**
 * Configuration for realtime subscriptions
 */
export interface RealtimeSubscriptionConfig {
  /** Schema to subscribe to (default: 'public') */
  schema?: string
  /** Table to subscribe to */
  table: string
  /** Event types to listen for (default: '*') */
  event?: RealtimeEventType
  /** Filter by column value (e.g., { column: 'channel_id', value: '123' }) */
  filter?: {
    column: string
    value: string | number
  }
}

/**
 * Channel configuration for presence tracking
 */
export interface PresenceChannelConfig {
  /** Unique channel name (e.g., 'room:123', 'chat:abc') */
  channelName: string
  /** User's presence state to broadcast */
  userState: Omit<PresenceState, "online_at">
}

/**
 * Broadcast message for realtime channels
 */
export interface BroadcastMessage<T = unknown> {
  type: string
  event: string
  payload: T
}

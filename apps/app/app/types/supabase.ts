export type SupabaseDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          has_completed_onboarding: boolean | null
          first_name: string | null
          last_name: string | null
          full_name: string | null
          dark_mode_enabled: boolean | null
          notifications_enabled: boolean | null
          push_notifications_enabled: boolean | null
          email_notifications_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          id: string
          has_completed_onboarding?: boolean | null
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          dark_mode_enabled?: boolean | null
          notifications_enabled?: boolean | null
          push_notifications_enabled?: boolean | null
          email_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          has_completed_onboarding?: boolean | null
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          dark_mode_enabled?: boolean | null
          notifications_enabled?: boolean | null
          push_notifications_enabled?: boolean | null
          email_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          device_id: string | null
          device_name: string | null
          platform: "ios" | "android" | "web" | null
          is_active: boolean
          last_used_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          device_id?: string | null
          device_name?: string | null
          platform?: "ios" | "android" | "web" | null
          is_active?: boolean
          last_used_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          device_id?: string | null
          device_name?: string | null
          platform?: "ios" | "android" | "web" | null
          is_active?: boolean
          last_used_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          id: string
          user_id: string
          name: string
          sku_code: string | null
          description: string | null
          price: number | null
          uom: string | null
          safety_stock_threshold: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          sku_code?: string | null
          description?: string | null
          price?: number | null
          uom?: string | null
          safety_stock_threshold?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          sku_code?: string | null
          description?: string | null
          price?: number | null
          uom?: string | null
          safety_stock_threshold?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_quantity: {
        Row: {
          id: string
          user_id: string
          sku_id: string
          total_quantity: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          sku_id: string
          total_quantity?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          sku_id?: string
          total_quantity?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          id: string
          user_id: string
          sku_id: string
          adjustment_type: "PURCHASE" | "SALE" | "STOCK_TAKE" | "SCRAP"
          quantity: number
          reference_note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          sku_id: string
          adjustment_type: "PURCHASE" | "SALE" | "STOCK_TAKE" | "SCRAP"
          quantity: number
          reference_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          sku_id?: string
          adjustment_type?: "PURCHASE" | "SALE" | "STOCK_TAKE" | "SCRAP"
          quantity?: number
          reference_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_takes: {
        Row: {
          id: string
          user_id: string
          sku_id: string
          counted_quantity: number
          system_quantity_at_time: number
          variance: number
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          sku_id: string
          counted_quantity: number
          system_quantity_at_time: number
          variance: number
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          sku_id?: string
          counted_quantity?: number
          system_quantity_at_time?: number
          variance?: number
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/**
 * User preferences that sync to the profiles table
 */
export interface UserPreferences {
  dark_mode_enabled: boolean | null
  notifications_enabled: boolean | null
  push_notifications_enabled: boolean | null
  email_notifications_enabled: boolean | null
}

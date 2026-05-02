import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/hooks"
import { supabase } from "@/services/supabase"

import { queryKeys } from "./queryKeys"

/** Row shape from `profiles` (matches Profile screen select). */
export interface ProfileRow {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  created_at: string | null
  updated_at: string | null
  preferred_currency_code: string | null
}

export function useProfileQuery() {
  const { userId } = useAuth()

  return useQuery({
    queryKey: queryKeys.user.profile(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, created_at, updated_at, preferred_currency_code")
        .eq("id", userId)
        .single()

      if (error?.code === "PGRST116") {
        return null
      }
      if (error) {
        throw error
      }

      return data as unknown as ProfileRow
    },
    staleTime: 1000 * 60 * 5,
  })
}

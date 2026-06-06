import { useEffect, useState } from "react"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"

import { supabase } from "@/services/supabase"
import { useAuthStore, useSubscriptionStore } from "@/stores"

export function useTrialStatus() {
  const userId = useAuthStore((state) => state.user?.id)
  const isPro = useSubscriptionStore((state) => state.isPro)
  const [daysRemaining, setDaysRemaining] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    setIsLoading(true)
    supabase
      .from("profiles")
      .select("created_at, id")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!isMounted) return

        const profile = data as { created_at: string | null } | null
        const createdAt = profile?.created_at
        if (createdAt) {
          setDaysRemaining(
            Math.max(0, differenceInCalendarDays(addDays(parseISO(createdAt), 30), new Date())),
          )
        }
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [userId])

  return {
    isTrialExpired: daysRemaining === 0 && !isPro,
    daysRemaining,
    isPro,
    isLoading,
  }
}

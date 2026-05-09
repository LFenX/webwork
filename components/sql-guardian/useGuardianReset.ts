"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { postGuardianReset } from "@/lib/sql-guardian/client-api"
import type {
  GuardianResetResponse,
  GuardianResetScope,
} from "@/lib/sql-guardian/types"

type UseGuardianResetOptions = {
  onReset?: (response: GuardianResetResponse) => void
}

export const GUARDIAN_RESET_CONFIRM_TEXT = "RESET SQL GUARDIAN"

export function useGuardianReset({ onReset }: UseGuardianResetOptions = {}) {
  const [scope, setScope] = useState<GuardianResetScope>("dialogues")
  const [confirmText, setConfirmText] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GuardianResetResponse | null>(null)
  const pendingRef = useRef(false)

  const canSubmit = confirmText === GUARDIAN_RESET_CONFIRM_TEXT && !pending

  const submitReset = useCallback(async () => {
    if (!canSubmit || pendingRef.current) return null

    pendingRef.current = true
    setPending(true)
    setError(null)

    const response = await postGuardianReset({ scope, confirmText })
    pendingRef.current = false
    setPending(false)

    if (!response) {
      setError("reset-failed")
      return null
    }

    setConfirmText("")
    setLastResult(response)
    onReset?.(response)
    return response
  }, [canSubmit, confirmText, onReset, scope])

  return useMemo(() => ({
    scope,
    setScope,
    confirmText,
    setConfirmText,
    pending,
    error,
    lastResult,
    canSubmit,
    submitReset,
  }), [
    canSubmit,
    confirmText,
    error,
    lastResult,
    pending,
    scope,
    submitReset,
  ])
}

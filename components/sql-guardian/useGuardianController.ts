"use client"

import { useCallback, useReducer } from "react"
import {
  createInitialGuardianState,
  reduceGuardianState,
} from "@/lib/sql-guardian/state-machine"
import type { GuardianEvent } from "@/lib/sql-guardian/types"

export function useGuardianController(initialIsSqlLab: boolean) {
  const [state, dispatch] = useReducer(
    reduceGuardianState,
    initialIsSqlLab,
    (isSqlLab) => createInitialGuardianState(isSqlLab)
  )

  const send = useCallback((event: GuardianEvent) => {
    dispatch({
      ...event,
      at: event.at ?? Date.now(),
    })
  }, [])

  return { state, send }
}

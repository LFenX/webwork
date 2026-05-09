"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  fetchGuardianSettings,
  patchGuardianSettings,
} from "@/lib/sql-guardian/client-api"
import type {
  GuardianProfile,
  GuardianSettings,
  GuardianSettingsResponse,
} from "@/lib/sql-guardian/types"

export const DEFAULT_GUARDIAN_CLIENT_SETTINGS = {
  guardianEnabled: true,
  animationsEnabled: true,
  autoPatrolEnabled: true,
  autoBubbleEnabled: true,
  autoBubbleInSqlLab: false,
  guardianEventTrackingEnabled: true,
  guardianChatHistoryEnabled: true,
  guardianMemoryEnabled: true,
  sqlAssistantPersonaEnabled: true,
  soulwingToGuardianMemoryBridgeEnabled: false,
  guardianToSoulWingMemoryBridgeEnabled: false,
} as const satisfies GuardianSettings

type UseGuardianSettingsOptions = {
  profile: GuardianProfile
  onProfileUpdated?: (response: GuardianSettingsResponse) => void
}

export function getGuardianClientSettings(profile: GuardianProfile): GuardianSettings {
  return {
    ...DEFAULT_GUARDIAN_CLIENT_SETTINGS,
    ...profile.preferences,
  }
}

export function useGuardianSettings({ profile, onProfileUpdated }: UseGuardianSettingsOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const fetchedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const settings = useMemo(() => getGuardianClientSettings(profile), [profile])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const refreshSettings = useCallback(async (signal?: AbortSignal) => {
    if (mountedRef.current) setLoading(true)
    const response = await fetchGuardianSettings({ signal })
    if (signal?.aborted || !mountedRef.current) return null

    setLoading(false)
    fetchedRef.current = true
    if (!response) {
      setError("settings-unavailable")
      return null
    }

    setError(null)
    onProfileUpdated?.(response)
    return response
  }, [onProfileUpdated])

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
    if (!fetchedRef.current && !loading) {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      void refreshSettings(controller.signal)
    }
  }, [loading, refreshSettings])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const updateSetting = useCallback(async <K extends keyof GuardianSettings>(
    key: K,
    value: GuardianSettings[K]
  ) => {
    const response = await patchGuardianSettings({ [key]: value } as Partial<GuardianSettings>)
    if (!mountedRef.current) return response
    if (!response) {
      setError("settings-update-failed")
      return null
    }

    setError(null)
    onProfileUpdated?.(response)
    return response
  }, [onProfileUpdated])

  return useMemo(() => ({
    settings,
    settingsOpen,
    loading,
    error,
    openSettings,
    closeSettings,
    refreshSettings,
    updateSetting,
  }), [
    closeSettings,
    error,
    loading,
    openSettings,
    refreshSettings,
    settings,
    settingsOpen,
    updateSetting,
  ])
}

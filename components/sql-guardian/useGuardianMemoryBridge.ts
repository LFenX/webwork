"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  fetchGuardianMemoryBridges,
  fetchGuardianMemoryBridgeSettings,
  patchGuardianMemoryBridgeSettings,
  revokeGuardianMemoryBridge,
} from "@/lib/sql-guardian/client-api"
import type {
  GuardianMemoryBridgeClient,
  GuardianMemoryBridgeSettings,
  GuardianProfile,
} from "@/lib/sql-guardian/types"

type UseGuardianMemoryBridgeOptions = {
  profile: GuardianProfile
}

const DEFAULT_SETTINGS: GuardianMemoryBridgeSettings = {
  soulwingToGuardianMemoryBridgeEnabled: false,
  guardianToSoulWingMemoryBridgeEnabled: false,
}

export function useGuardianMemoryBridge({ profile }: UseGuardianMemoryBridgeOptions) {
  const [items, setItems] = useState<GuardianMemoryBridgeClient[]>([])
  const [settings, setSettings] = useState<GuardianMemoryBridgeSettings>(() => ({
    ...DEFAULT_SETTINGS,
    soulwingToGuardianMemoryBridgeEnabled: profile.preferences?.soulwingToGuardianMemoryBridgeEnabled === true,
    guardianToSoulWingMemoryBridgeEnabled: profile.preferences?.guardianToSoulWingMemoryBridgeEnabled === true,
  }))
  const [soulWingMemoryAvailable, setSoulWingMemoryAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bridgeOpen, setBridgeOpen] = useState(false)
  const mountedRef = useRef(false)
  const fetchedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const soulwingToGuardianEnabled = settings.soulwingToGuardianMemoryBridgeEnabled

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const refreshBridge = useCallback(async (signal?: AbortSignal) => {
    if (mountedRef.current) setLoading(true)
    const [settingsResponse, listResponse] = await Promise.all([
      fetchGuardianMemoryBridgeSettings({ signal }),
      fetchGuardianMemoryBridges({ direction: "soulwing_to_guardian", status: ["active"], signal }),
    ])
    if (signal?.aborted || !mountedRef.current) return null

    setLoading(false)
    fetchedRef.current = true
    if (!settingsResponse || !listResponse) {
      setError("bridge-unavailable")
      return null
    }
    setError(null)
    setSettings(settingsResponse.settings)
    setSoulWingMemoryAvailable(settingsResponse.soulWingMemoryAvailable)
    setItems(listResponse.items)
    return { settings: settingsResponse, items: listResponse.items }
  }, [])

  const openBridge = useCallback(() => {
    setBridgeOpen(true)
    if (!fetchedRef.current && !loading) {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      void refreshBridge(controller.signal)
    }
  }, [loading, refreshBridge])

  const closeBridge = useCallback(() => {
    setBridgeOpen(false)
  }, [])

  const setSoulwingToGuardianEnabled = useCallback(async (enabled: boolean) => {
    const response = await patchGuardianMemoryBridgeSettings({
      soulwingToGuardianMemoryBridgeEnabled: enabled,
    })
    if (!mountedRef.current) return response
    if (!response) {
      setError("bridge-toggle-failed")
      return null
    }
    setError(null)
    setSettings(response.settings)
    setSoulWingMemoryAvailable(response.soulWingMemoryAvailable)
    return response
  }, [])

  const revokeBridge = useCallback(async (id: string) => {
    const response = await revokeGuardianMemoryBridge(id)
    if (!mountedRef.current) return response
    if (!response) {
      setError("bridge-revoke-failed")
      return null
    }
    setError(null)
    setItems((current) => current.filter((item) => item.id !== id))
    return response
  }, [])

  return useMemo(() => ({
    items,
    settings,
    soulWingMemoryAvailable,
    soulwingToGuardianEnabled,
    loading,
    error,
    bridgeOpen,
    openBridge,
    closeBridge,
    refreshBridge,
    setSoulwingToGuardianEnabled,
    revokeBridge,
  }), [
    bridgeOpen,
    closeBridge,
    error,
    items,
    loading,
    openBridge,
    refreshBridge,
    revokeBridge,
    setSoulwingToGuardianEnabled,
    settings,
    soulWingMemoryAvailable,
    soulwingToGuardianEnabled,
  ])
}

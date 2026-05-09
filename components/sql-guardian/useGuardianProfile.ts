"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchGuardianProfile,
  patchGuardianProfile,
  postGuardianEvent,
} from "@/lib/sql-guardian/client-api"
import {
  canSendGuardianClientEvent,
  markGuardianClientEventSent,
} from "@/lib/sql-guardian/client-throttle"
import { mockGuardianProfile } from "@/lib/sql-guardian/mock-profile"
import type {
  GuardianChatResponse,
  GuardianClientEventType,
  GuardianEventResponse,
  GuardianMood,
  GuardianPreferences,
  GuardianProfileClient,
  GuardianProgress,
  GuardianProfileResponse,
  GuardianResetResponse,
  GuardianSettingsResponse,
} from "@/lib/sql-guardian/types"

type RecordGuardianEventInput = {
  eventType: GuardianClientEventType
  source?: string
  pagePath?: string
  eventPayloadJson?: Record<string, unknown>
}

type UpdateGuardianProfileInput = {
  name?: string
  mood?: GuardianMood
  preferencesJson?: Partial<GuardianPreferences>
}

type GuardianLevelUp = {
  level: number
  title: string
  expDelta: number
  at: number
}

type GuardianProfileUpdatePayload =
  | GuardianProfileResponse
  | GuardianEventResponse
  | GuardianChatResponse
  | GuardianSettingsResponse
  | GuardianResetResponse

const MOCK_PROGRESS = {
  level: mockGuardianProfile.level,
  currentLevelExp: 0,
  nextLevelExp: 40,
  progress: 0,
} satisfies GuardianProgress

function canRecordEvents(profile: GuardianProfileClient) {
  return profile.preferences?.guardianEnabled !== false &&
    profile.preferences?.guardianEventTrackingEnabled !== false
}

export function useGuardianProfile() {
  const [profile, setProfile] = useState<GuardianProfileClient>(mockGuardianProfile)
  const [progress, setProgress] = useState<GuardianProgress>(MOCK_PROGRESS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventsEnabled, setEventsEnabled] = useState(false)
  const [lastExpDelta, setLastExpDelta] = useState<number | null>(null)
  const [lastLevelUp, setLastLevelUp] = useState<GuardianLevelUp | null>(null)
  const mountedRef = useRef(false)
  const profileRef = useRef<GuardianProfileClient>(mockGuardianProfile)
  const postInFlightRef = useRef(new Set<GuardianClientEventType>())

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const applyProfileResponse = useCallback((response: GuardianProfileResponse) => {
    if (!mountedRef.current) return
    setProfile(response.profile)
    setProgress(response.progress)
    setError(null)
    setEventsEnabled(true)
  }, [])

  const applyProfileUpdate = useCallback((response: GuardianProfileUpdatePayload) => {
    if (!mountedRef.current) return
    const previousProfile = profileRef.current
    const expDelta = "event" in response ? response.event.expDelta : null

    setLastExpDelta(expDelta)
    setProfile(response.profile)
    setProgress(response.progress)
    setError(null)
    setEventsEnabled(true)

    if (response.profile.level > previousProfile.level) {
      setLastLevelUp({
        level: response.profile.level,
        title: response.profile.title,
        expDelta: expDelta ?? 0,
        at: Date.now(),
      })
    }
  }, [])

  const refreshProfile = useCallback(async (signal?: AbortSignal) => {
    if (mountedRef.current) {
      setLoading(true)
    }

    const response = await fetchGuardianProfile({ signal })
    if (signal?.aborted || !mountedRef.current) return null

    setLoading(false)
    if (!response) {
      setProfile(mockGuardianProfile)
      setProgress(MOCK_PROGRESS)
      setEventsEnabled(false)
      setError("profile-unavailable")
      return null
    }

    applyProfileResponse(response)
    return response
  }, [applyProfileResponse])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void refreshProfile(controller.signal)
    }, 0)

    return () => {
      mountedRef.current = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [refreshProfile])

  const recordEvent = useCallback(async (input: RecordGuardianEventInput): Promise<GuardianEventResponse | null> => {
    if (!eventsEnabled) return null
    if (!canRecordEvents(profileRef.current)) return null
    if (postInFlightRef.current.has(input.eventType)) return null
    if (!canSendGuardianClientEvent(input.eventType)) return null

    const previousProfile = profileRef.current
    postInFlightRef.current.add(input.eventType)
    markGuardianClientEventSent(input.eventType)

    const response = await postGuardianEvent(input)
    postInFlightRef.current.delete(input.eventType)
    if (!response || !mountedRef.current) return response

    setLastExpDelta(response.event.expDelta)
    setProfile(response.profile)
    setProgress(response.progress)
    setError(null)

    if (response.profile.level > previousProfile.level) {
      setLastLevelUp({
        level: response.profile.level,
        title: response.profile.title,
        expDelta: response.event.expDelta,
        at: Date.now(),
      })
    }

    return response
  }, [eventsEnabled])

  const updateProfile = useCallback(async (input: UpdateGuardianProfileInput) => {
    const response = await patchGuardianProfile(input)
    if (!response || !mountedRef.current) return null
    applyProfileResponse(response)
    return response
  }, [applyProfileResponse])

  const acknowledgeLevelUp = useCallback(() => {
    setLastLevelUp(null)
  }, [])

  return {
    profile,
    progress,
    loading,
    error,
    eventsEnabled,
    refreshProfile,
    recordEvent,
    updateProfile,
    applyProfileUpdate,
    lastExpDelta,
    lastLevelUp,
    acknowledgeLevelUp,
  }
}

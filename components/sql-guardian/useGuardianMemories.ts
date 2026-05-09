"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  createGuardianMemory,
  deleteGuardianMemory,
  fetchGuardianMemories,
  updateGuardianMemory,
} from "@/lib/sql-guardian/client-api"
import type {
  GuardianMemoryClient,
  GuardianPreferences,
  GuardianProfile,
  GuardianProfileResponse,
} from "@/lib/sql-guardian/types"

type UseGuardianMemoriesOptions = {
  profile: GuardianProfile
  updateProfile: (input: { preferencesJson?: Partial<GuardianPreferences> }) => Promise<GuardianProfileResponse | null>
}

function mergeMemories(current: GuardianMemoryClient[], incoming: GuardianMemoryClient[]) {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "candidate" ? -1 : 1
    if (a.importance !== b.importance) return b.importance - a.importance
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export function useGuardianMemories({ profile, updateProfile }: UseGuardianMemoriesOptions) {
  const [memories, setMemories] = useState<GuardianMemoryClient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [candidateNoticeCount, setCandidateNoticeCount] = useState(0)
  const mountedRef = useRef(false)
  const fetchedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const memoryEnabled = profile.preferences?.guardianMemoryEnabled !== false

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const refreshMemories = useCallback(async (signal?: AbortSignal) => {
    if (mountedRef.current) setLoading(true)
    const response = await fetchGuardianMemories({ limit: 30, signal })
    if (signal?.aborted || !mountedRef.current) return null

    setLoading(false)
    fetchedRef.current = true
    if (!response) {
      setError("memory-unavailable")
      return null
    }
    setError(null)
    setMemories(response.items)
    return response
  }, [])

  const openMemory = useCallback(() => {
    setMemoryOpen(true)
    setCandidateNoticeCount(0)
    if (!fetchedRef.current && !loading) {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      void refreshMemories(controller.signal)
    }
  }, [loading, refreshMemories])

  const closeMemory = useCallback(() => {
    setMemoryOpen(false)
  }, [])

  const createMemory = useCallback(async () => {
    const content = draft.trim()
    if (!content) return null
    const response = await createGuardianMemory({
      type: "preference",
      content,
      importance: 2,
    })
    if (!mountedRef.current) return response
    if (!response) {
      setError(memoryEnabled ? "memory-create-failed" : "MEMORY_DISABLED")
      return null
    }
    setDraft("")
    setError(null)
    setMemories((current) => mergeMemories(current, [response.memory]))
    return response
  }, [draft, memoryEnabled])

  const updateMemoryStatus = useCallback(async (id: string, status: "active" | "rejected" | "archived") => {
    const response = await updateGuardianMemory(id, { status })
    if (!mountedRef.current) return response
    if (!response) {
      setError("memory-update-failed")
      return null
    }
    setError(null)
    if (status === "rejected" || status === "archived") {
      setMemories((current) => current.filter((item) => item.id !== id))
    } else {
      setMemories((current) => mergeMemories(current, [response.memory]))
    }
    return response
  }, [])

  const removeMemory = useCallback(async (id: string) => {
    const response = await deleteGuardianMemory(id)
    if (!mountedRef.current) return response
    if (!response) {
      setError("memory-delete-failed")
      return null
    }
    setError(null)
    setMemories((current) => current.filter((item) => item.id !== id))
    return response
  }, [])

  const setMemoryEnabled = useCallback(async (enabled: boolean) => {
    const response = await updateProfile({
      preferencesJson: { guardianMemoryEnabled: enabled },
    })
    if (!mountedRef.current) return response
    if (!response) {
      setError("memory-toggle-failed")
      return null
    }
    setError(null)
    return response
  }, [updateProfile])

  const handleChatMemoryCandidates = useCallback((candidates?: GuardianMemoryClient[]) => {
    if (!candidates?.length || !mountedRef.current) return
    setMemories((current) => mergeMemories(current, candidates))
    if (!memoryOpen) setCandidateNoticeCount((count) => count + candidates.length)
  }, [memoryOpen])

  return {
    memories,
    loading,
    error,
    memoryOpen,
    draft,
    setDraft,
    memoryEnabled,
    candidateNoticeCount,
    openMemory,
    closeMemory,
    refreshMemories,
    createMemory,
    confirmMemory: (id: string) => updateMemoryStatus(id, "active"),
    rejectMemory: (id: string) => updateMemoryStatus(id, "rejected"),
    archiveMemory: (id: string) => updateMemoryStatus(id, "archived"),
    deleteMemory: removeMemory,
    setMemoryEnabled,
    handleChatMemoryCandidates,
  }
}

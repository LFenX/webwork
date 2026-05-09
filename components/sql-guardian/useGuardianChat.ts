"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchGuardianDialogues,
  postGuardianChat,
} from "@/lib/sql-guardian/client-api"
import type {
  GuardianChatResponse,
  GuardianDialogueClient,
  GuardianEventResponse,
  GuardianMemoryClient,
  GuardianProfileResponse,
} from "@/lib/sql-guardian/types"

const CHAT_CLIENT_COOLDOWN_MS = 5_000
const LOCAL_FALLBACK_REPLY = "信号有点乱，我这次没能接住你的话。等风平一点，我们再试一次。"
const LOCAL_COOLDOWN_REPLY = "我还在整理上一段潮汐，稍等几秒再喊我。"

type UseGuardianChatOptions = {
  pagePath: string
  guardianEnabled?: boolean
  chatHistoryEnabled?: boolean
  onReply?: (reply: string) => void
  onProfileUpdated?: (payload: GuardianProfileResponse | GuardianEventResponse | GuardianChatResponse) => void
  onLevelUp?: (level: number, title: string) => void
  onMemoryCandidates?: (candidates?: GuardianMemoryClient[]) => void
}

export function useGuardianChat({
  pagePath,
  guardianEnabled = true,
  chatHistoryEnabled = true,
  onReply,
  onProfileUpdated,
  onLevelUp,
  onMemoryCandidates,
}: UseGuardianChatOptions) {
  const [dialogues, setDialogues] = useState<GuardianDialogueClient[]>([])
  const [loadingDialogues, setLoadingDialogues] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [input, setInput] = useState("")
  const mountedRef = useRef(false)
  const pendingRef = useRef(false)
  const lastSentAtRef = useRef(0)
  const lastKnownLevelRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshDialogues = useCallback(async (signal?: AbortSignal) => {
    if (!guardianEnabled || !chatHistoryEnabled) {
      setDialogues([])
      return null
    }
    if (mountedRef.current) setLoadingDialogues(true)
    const response = await fetchGuardianDialogues({ limit: 12, signal })
    if (signal?.aborted || !mountedRef.current) return null

    setLoadingDialogues(false)
    if (!response) return null
    setDialogues(response.items)
    return response
  }, [chatHistoryEnabled, guardianEnabled])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    const timer = window.setTimeout(() => {
      void refreshDialogues(controller.signal)
    }, 0)

    return () => {
      mountedRef.current = false
      window.clearTimeout(timer)
      controller.abort()
      abortRef.current = null
    }
  }, [refreshDialogues])

  const openChat = useCallback(() => {
    setChatOpen(true)
    if (!guardianEnabled || !chatHistoryEnabled) return
    if (!dialogues.length && !loadingDialogues) {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      void refreshDialogues(controller.signal)
    }
  }, [chatHistoryEnabled, dialogues.length, guardianEnabled, loadingDialogues, refreshDialogues])

  const closeChat = useCallback(() => {
    setChatOpen(false)
  }, [])

  const sendMessage = useCallback(async () => {
    const message = input.trim()
    if (!message || pendingRef.current) return null
    if (!guardianEnabled) {
      setError("guardian-disabled")
      return null
    }

    if (message.length > 1000) {
      setError("message-too-long")
      return null
    }

    const now = Date.now()
    if (now - lastSentAtRef.current < CHAT_CLIENT_COOLDOWN_MS) {
      setError("cooldown")
      onReply?.(LOCAL_COOLDOWN_REPLY)
      return null
    }

    pendingRef.current = true
    lastSentAtRef.current = now
    setPending(true)
    setError(null)

    const response = await postGuardianChat({ message, pagePath })
    pendingRef.current = false
    if (!mountedRef.current) return response

    setPending(false)
    if (!response) {
      setError("chat-unavailable")
      onReply?.(LOCAL_FALLBACK_REPLY)
      return null
    }

    if (response.dialogue) {
      setDialogues((current) => [...current, response.dialogue!.user, response.dialogue!.assistant].slice(-12))
      setInput("")
      setError(null)
    } else if (!chatHistoryEnabled && !response.fallback) {
      setInput("")
      setError(null)
    } else if (response.fallbackReason) {
      setError(response.fallbackReason)
    }

    const previousLevel = lastKnownLevelRef.current
    lastKnownLevelRef.current = response.profile.level
    if (previousLevel !== null && response.profile.level > previousLevel) {
      onLevelUp?.(response.profile.level, response.profile.title)
    }

    onProfileUpdated?.(response)
    onMemoryCandidates?.(response.memoryCandidates)
    onReply?.(response.reply)
    return response
  }, [chatHistoryEnabled, guardianEnabled, input, onLevelUp, onMemoryCandidates, onProfileUpdated, onReply, pagePath])

  return {
    dialogues,
    loadingDialogues,
    pending,
    error,
    chatOpen,
    input,
    setInput,
    openChat,
    closeChat,
    sendMessage,
    refreshDialogues,
  }
}

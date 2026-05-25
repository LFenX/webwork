"use client"

import Link from "next/link"
import { type ClipboardEvent as ReactClipboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  File as FileIcon,
  Loader2,
  Paperclip,
  RefreshCcw,
  Send,
} from "lucide-react"
import { ComposerReplyPreview, MessageActionSurface, MessageReplyReference, type MessageActionItem } from "@/components/chat-message-actions"
import { ChatComposerAttachments } from "@/components/chat-composer-attachments"
import { ChatMessagesLoading } from "@/components/loading/app-loading-states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { setActiveChatContext } from "@/lib/active-chat"
import { copyImageToClipboard, getClipboardImageFiles, saveStickerToCustomLibrary, triggerBrowserDownload } from "@/lib/chat-media-actions"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { publicProfileHref } from "@/lib/public-profile"

export interface ChatFriend {
  id: string
  email: string
  publicSlug?: string | null
  displayName: string
  avatarText: string
  avatarUrl: string | null
  presenceStatus?: "online" | "away" | "offline"
}

export type ChatAttachment = {
  id: string
  originalName: string
  mimeType: string
  size: number
  downloadUrl: string
}

type ChatStickerAsset = {
  id: string
  url: string
  scope?: string
  name?: string
  originalName?: string
  mimeType?: string
  size?: number
  isAnimated?: boolean
}

export type ReplyPreview = {
  id: string
  senderId: string
  text: string
  stickerEmoji?: string | null
  sticker?: ChatStickerAsset | null
  sender?: ChatFriend
  attachments: ChatAttachment[]
}

export type ChatMessage = {
  id: string
  senderId: string
  receiverId: string
  text: string
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: ChatStickerAsset | null
  readAt: string | null
  createdAt: string
  sender?: ChatFriend
  replyTo?: ReplyPreview | null
  attachments: ChatAttachment[]
  localStatus?: "sending" | "failed"
  progress?: number
  error?: string
  clientMutationId?: string
}

function submitOnTouchBeforeKeyboardBlur(event: ReactPointerEvent<HTMLButtonElement>, submit: () => void) {
  if (event.pointerType === "mouse") return
  event.preventDefault()
  submit()
}

export type ChatSummary = {
  friendId: string
  unreadCount: number
  latest: {
    text: string
    createdAt: string
    hasAttachment: boolean
    hasSticker?: boolean
    stickerEmoji?: string | null
  } | null
}

type ComposerLabels = {
  chooseFriend: string
  chooseFriendHint: string
  online: string
  away: string
  offline: string
  noMessages: string
  loading: string
  refresh: string
  loadOlder: string
  loadingOlder: string
  typeMessage: string
  send: string
  sending: string
  sticker: string
  imagePreview: string
  openProfile: string
  viewProfile: string
  openChatPage: string
  retrySend: string
  discardFailed: string
  sendingFailed: string
  delivered: string
  read: string
  you: string
  replyingTo: string
  cancelReply: string
  reply: string
  copy: string
  copied: string
  copyFailed: string
  image: string
  attachment: string
  noHistory: string
}

function getLocale() {
  if (typeof document === "undefined") return "zh-CN"
  return document.documentElement.lang === "en-US" ? "en-US" : "zh-CN"
}

function getLabels(): ComposerLabels {
  if (getLocale() === "en-US") {
    return {
      chooseFriend: "Choose a friend to start chatting",
      chooseFriendHint: "You can send text, stickers, images, and files.",
      online: "Online",
      away: "Away",
      offline: "Offline",
      noMessages: "No messages yet. Say hello first.",
      loading: "Loading messages...",
      refresh: "Refresh",
      loadOlder: "Load earlier messages",
      loadingOlder: "Loading earlier messages...",
      typeMessage: "Type a message...",
      send: "Send",
      sending: "Sending",
      sticker: "Sticker",
      imagePreview: "Image preview",
      openProfile: "Open profile",
      viewProfile: "Profile",
      openChatPage: "Open chat page",
      retrySend: "Retry",
      discardFailed: "Discard",
      sendingFailed: "Failed to send",
      delivered: "Delivered",
      read: "Read",
      you: "You",
      replyingTo: "Replying to",
      cancelReply: "Cancel reply",
      reply: "Reply",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed",
      image: "Image",
      attachment: "Attachment",
      noHistory: "No chat history yet",
    }
  }
  return {
    chooseFriend: "选择一个好友开始聊天",
    chooseFriendHint: "你可以发送文字、表情、图片和文件。",
    online: "在线",
    away: "离开",
    offline: "离线",
    noMessages: "还没有消息，先打个招呼吧。",
    loading: "正在加载聊天记录...",
    refresh: "刷新",
    loadOlder: "加载更早消息",
    loadingOlder: "正在加载更早消息...",
    typeMessage: "输入消息...",
    send: "发送",
    sending: "发送中",
    sticker: "表情",
    imagePreview: "图片预览",
    openProfile: "打开资料",
    viewProfile: "主页",
    openChatPage: "聊天页",
    retrySend: "重试",
    discardFailed: "放弃",
    sendingFailed: "发送失败",
    delivered: "已送达",
    read: "已读",
    you: "你",
    replyingTo: "正在回复",
    cancelReply: "取消回复",
    reply: "回复",
    image: "图片",
    attachment: "附件",
    noHistory: "还没有聊天记录",
  } as ComposerLabels
}

const TIME_GAP_MS = 5 * 60 * 1000
const INITIAL_HISTORY_BATCH_SIZE = 40
const OLDER_HISTORY_BATCH_SIZE = 10
const BOTTOM_STICKY_THRESHOLD = 96

export function presenceLabel(status?: ChatFriend["presenceStatus"]) {
  const labels = getLabels()
  if (status === "online") return labels.online
  if (status === "away") return labels.away
  return labels.offline
}

function summaryPreviewText(summary?: ChatSummary["latest"]) {
  const labels = getLabels()
  if (!summary) return labels.noHistory
  if (summary.text?.trim()) return summary.text.trim()
  if (summary.stickerEmoji || summary.hasSticker) return `[${labels.sticker}]`
  if (summary.hasAttachment) return `[${labels.attachment}]`
  return labels.noHistory
}

export function messagePreview(summary?: ChatSummary) {
  const text = summaryPreviewText(summary?.latest)
  return text.length > 32 ? `${text.slice(0, 32)}...` : text
}

function formatTime(value: string) {
  const locale = getLocale()
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false })

  if (diffDays <= 0) return time
  if (diffDays < 7) return `${date.toLocaleDateString(locale, { weekday: "short" })} ${time}`
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${time}`
}

function shouldShowTime(previous: ChatMessage | undefined, current: ChatMessage) {
  if (!previous) return true
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > TIME_GAP_MS
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function isNearBottom(element: HTMLElement | null) {
  if (!element) return true
  return element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_STICKY_THRESHOLD
}

function makeClientMessageCursor(message: Pick<ChatMessage, "id" | "createdAt"> | null | undefined) {
  if (!message) return null
  return `${new Date(message.createdAt).toISOString()}|${message.id}`
}

function isEarlierMessage(a: ChatMessage | undefined, b: ChatMessage | undefined) {
  if (!a || !b) return false
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  if (timeDiff !== 0) return timeDiff < 0
  return a.id < b.id
}

async function compressImageIfNeeded(file: File) {
  return file
}

function compareChatMessages(a: ChatMessage, b: ChatMessage) {
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  if (timeDiff !== 0) return timeDiff
  return a.id.localeCompare(b.id)
}

function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>()
  for (const message of current) byId.set(message.id, message)
  for (const message of incoming) {
    const existing = byId.get(message.id)
    byId.set(message.id, existing ? { ...existing, ...message } : message)
  }
  return [...byId.values()].sort(compareChatMessages)
}

function getReplySummary(reply?: ReplyPreview | null) {
  const labels = getLabels()
  if (!reply) return ""
  if (reply.text.trim()) return reply.text.trim()
  if (reply.stickerEmoji || reply.sticker) return `[${labels.sticker}]`
  if (reply.attachments.some((attachment) => attachment.mimeType.startsWith("image/"))) return `[${labels.image}]`
  if (reply.attachments.length > 0) return `[${labels.attachment}]`
  return ""
}

function messageToReplyPreview(message: ChatMessage, sender: ChatFriend): ReplyPreview {
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text,
    stickerEmoji: message.stickerEmoji,
    sticker: message.sticker,
    sender,
    attachments: message.attachments,
  }
}

function getMessageCopyText(message: ChatMessage) {
  if (message.text.trim()) return message.text.trim()
  if (message.stickerEmoji) return message.stickerEmoji
  if (message.sticker) return `[${getLabels().sticker}]`
  if (message.attachments.length > 0) return message.attachments.map((attachment) => attachment.originalName).join("\n")
  return ""
}

function getPrimaryImageAttachment(message: ChatMessage) {
  const imageAttachments = message.attachments.filter((attachment) => attachment.mimeType.startsWith("image/"))
  return imageAttachments.length === 1 ? imageAttachments[0] : null
}

function uploadMessage({
  friendId,
  text,
  files,
  sticker,
  replyToId,
  onProgress,
}: {
  friendId: string
  text: string
  files: File[]
  sticker?: StickerPick | null
  replyToId?: string | null
  onProgress: (progress: number) => void
}) {
  return new Promise<ChatMessage>((resolve, reject) => {
    const form = new FormData()
    form.set("text", text)
    if (sticker?.type === "asset") form.set("stickerId", sticker.id)
    if (sticker?.type === "emoji") form.set("stickerEmoji", sticker.emoji)
    if (replyToId) form.set("replyToId", replyToId)
    files.forEach((file) => form.append("files", file))

    const request = new XMLHttpRequest()
    request.open("POST", `/api/chats/${friendId}/messages`)
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    request.onload = () => {
      const data = JSON.parse(request.responseText || "{}")
      if (request.status >= 200 && request.status < 300) resolve(data as ChatMessage)
      else reject(new Error(data.error ?? "Send failed"))
    }
    request.onerror = () => reject(new Error("Network error"))
    request.send(form)
  })
}

async function markChatMessagesRead(friendId: string, messageIds?: string[]) {
  const res = await fetch(`/api/chats/${friendId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageIds }),
    cache: "no-store",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to mark chat as read")
  }
}

export function useChatSession(friendId: string | null, initialFriend?: ChatFriend | null, onSummaryChange?: () => void, currentUser?: ChatFriend | null) {
  const [loadedFriend, setLoadedFriend] = useState<ChatFriend | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const nextCursorRef = useRef<string | null>(null)
  const friend = initialFriend ?? loadedFriend

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  useEffect(() => {
    setActiveChatContext(friendId ? { kind: "direct", id: friendId } : null)
    return () => setActiveChatContext(null)
  }, [friendId])

  const loadMessages = useCallback(async ({ cursor, appendOlder = false }: { cursor?: string | null; appendOlder?: boolean } = {}) => {
    if (!friendId) return
    if (appendOlder) setLoadingOlder(true)
    else setLoading(true)
    try {
      let items: ChatMessage[] = []
      let incomingNextCursor: string | null = null
      let loadedFriendPayload: ChatFriend | null = null

      if (appendOlder) {
        let cursorToUse = cursor ?? null
        let attempts = 0
        while (cursorToUse && attempts < 8) {
          const params = new URLSearchParams({
            limit: String(OLDER_HISTORY_BATCH_SIZE),
            _t: String(Date.now()),
          })
          params.set("cursor", cursorToUse)
          const res = await fetch(`/api/chats/${friendId}/messages?${params.toString()}`, { cache: "no-store" })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error ?? "Failed to load chat")
          const fetchedItems = Array.isArray(data.items) ? (data.items as ChatMessage[]) : []
          const fetchedNextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null
          const existingIds = new Set(messagesRef.current.map((item) => item.id))
          const nonDuplicateItems = fetchedItems.filter((item) => !existingIds.has(item.id))
          loadedFriendPayload = (data.friend as ChatFriend | null) ?? loadedFriendPayload
          items = fetchedItems
          incomingNextCursor = fetchedNextCursor
          if (nonDuplicateItems.length > 0 || !fetchedNextCursor) break
          cursorToUse = fetchedNextCursor
          attempts += 1
        }
      } else {
        const params = new URLSearchParams({
          limit: String(INITIAL_HISTORY_BATCH_SIZE),
          _t: String(Date.now()),
        })
        if (cursor) params.set("cursor", cursor)
        const res = await fetch(`/api/chats/${friendId}/messages?${params.toString()}`, { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? "Failed to load chat")
        items = Array.isArray(data.items) ? (data.items as ChatMessage[]) : []
        incomingNextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null
        loadedFriendPayload = (data.friend as ChatFriend | null) ?? null
      }

      setLoadedFriend(loadedFriendPayload)
      if (appendOlder) {
        const prependedIds: string[] = []
        setMessages((current) => {
          const existingIds = new Set(current.map((item) => item.id))
          const olderItems = items.filter((item) => !existingIds.has(item.id))
          prependedIds.push(...olderItems.map((item) => item.id))
          return [...olderItems, ...current]
        })
        setNextCursor(incomingNextCursor)
        return { prependedIds }
      } else {
        const currentServerMessages = messagesRef.current.filter((item) => !item.localStatus)
        const currentOldest = currentServerMessages[0]
        const incomingOldest = items[0]
        const shouldPreserveExpandedHistory =
          currentServerMessages.length > items.length ||
          isEarlierMessage(currentOldest, incomingOldest)

        setNextCursor(shouldPreserveExpandedHistory ? nextCursorRef.current : incomingNextCursor)
        setMessages((current) => mergeChatMessages(current.filter((item) => item.localStatus), items))
      }
      onSummaryChange?.()
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load chat")
    } finally {
      if (appendOlder) setLoadingOlder(false)
      else setLoading(false)
    }
  }, [friendId, onSummaryChange])

  const loadOlderMessages = useCallback(async () => {
    if (loading || loadingOlder) return
    const oldestLoadedServerMessage = messagesRef.current.find((message) => !message.localStatus) ?? null
    const cursor = makeClientMessageCursor(oldestLoadedServerMessage) ?? nextCursorRef.current
    if (!cursor) return
    return await loadMessages({ cursor, appendOlder: true })
  }, [loadMessages, loading, loadingOlder])

  useEffect(() => {
    if (!friendId) return
    const timer = window.setTimeout(() => {
      setMessages([])
      setFiles([])
      setSticker(null)
      setReplyTo(null)
      setNextCursor(null)
      void loadMessages()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [friendId, loadMessages])

  const syncReadState = useCallback(async (messageIds?: string[]) => {
    if (!friendId) return
    try {
      await markChatMessagesRead(friendId, messageIds)
    } catch {
      // Ignore transient sync failures; the next manual or visibility refresh will reconcile.
    }
  }, [friendId])

  useEffect(() => {
    if (!friendId) return
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      void loadMessages()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [friendId, loadMessages])

  useEffect(() => {
    if (!friendId) return
    const source = new EventSource(`/api/chats/${friendId}/events`)
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage
      if (message.senderId !== friendId) {
        onSummaryChange?.()
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
        return
      }
      setMessages((current) => mergeChatMessages(current, [message]))
      void syncReadState([message.id])
      onSummaryChange?.()
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
    })
    return () => source.close()
  }, [friendId, onSummaryChange, syncReadState])

  useEffect(() => {
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ friendId?: string; readMessageIds?: string[]; readAt?: string }>).detail
      if (!friendId || detail?.friendId !== friendId || !detail.readAt) return
      const ids = new Set(detail.readMessageIds ?? [])
      setMessages((current) => current.map((message) => (
        ids.has(message.id) || (message.senderId === "self" && !message.readAt)
          ? { ...message, readAt: detail.readAt ?? message.readAt }
          : message
      )))
    }
    window.addEventListener("chat-read", onRead)
    return () => window.removeEventListener("chat-read", onRead)
  }, [friendId])

  const sendMessage = useCallback(async () => {
    if (!friendId || !friend || sending) return
    const draftText = text.trim()
    if (!draftText && files.length === 0 && !sticker) return

    setSending(true)
    const draftFiles = [...files]
    setText("")
    setFiles([])
    setSticker(null)
    setReplyTo(null)

    const preparedFiles = await Promise.all(draftFiles.map((file) => compressImageIfNeeded(file)))
    const batches = [
      ...(draftText ? [{ text: draftText, files: [] as File[], sticker: null as StickerPick | null }] : []),
      ...preparedFiles.map((file) => ({ text: "", files: [file], sticker: null as StickerPick | null })),
      ...(sticker ? [{ text: "", files: [] as File[], sticker }] : []),
    ]
    const selfSender =
      currentUser
      ?? messagesRef.current.find((message) => message.senderId !== friend.id && message.sender)?.sender
      ?? { id: "self", email: "", displayName: "", avatarText: "", avatarUrl: null }
    const localEntries = batches.map((batch, index) => {
      const localId = `local-${crypto.randomUUID()}`
      const localFiles = batch.files.map((file, fileIndex) => ({
        id: `${localId}-file-${fileIndex}`,
        originalName: file.name || "file",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        downloadUrl: URL.createObjectURL(file),
      }))
      const localMessage: ChatMessage = {
        id: localId,
        senderId: selfSender.id || "self",
        receiverId: friendId,
        text: batch.text,
        readAt: null,
        createdAt: new Date().toISOString(),
        sender: selfSender,
        stickerId: batch.sticker?.type === "asset" ? batch.sticker.id : null,
        stickerEmoji: batch.sticker?.type === "emoji" ? batch.sticker.emoji : null,
        sticker: batch.sticker?.type === "asset" ? { id: batch.sticker.id, url: batch.sticker.url, name: batch.sticker.name } : null,
        replyTo: index === 0 ? replyTo : null,
        attachments: localFiles,
        localStatus: "sending",
        progress: 0,
      }
      return { batch, localId, localMessage }
    })
    setMessages((current) => [...current, ...localEntries.map((entry) => entry.localMessage)])

    let firstReplyId = replyTo?.id ?? null
    for (let index = 0; index < localEntries.length; index += 1) {
      const { batch, localId } = localEntries[index]
      try {
        const uploaded = await uploadMessage({
          friendId,
          text: batch.text,
          files: batch.files,
          sticker: batch.sticker,
          replyToId: index === 0 ? firstReplyId : null,
          onProgress: (progress) => {
            setMessages((current) => current.map((item) => (item.id === localId ? { ...item, progress } : item)))
          },
        })
        setMessages((current) => current.map((item) => (item.id === localId ? uploaded : item)))
        onSummaryChange?.()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Send failed"
        setMessages((current) => current.map((item) => (item.id === localId ? { ...item, localStatus: "failed", error: message, progress: 0 } : item)))
        toast.error(message)
      }
      firstReplyId = null
    }

    setSending(false)
  }, [currentUser, files, friend, friendId, onSummaryChange, replyTo, sending, sticker, text])

  const retryMessage = useCallback(async (messageId: string) => {
    const failed = messagesRef.current.find((message) => message.id === messageId)
    if (!failed) return
    setMessages((current) => current.filter((item) => item.id !== messageId))
    setText(failed.text)
    setSticker(
      failed.sticker
        ? { type: "asset", id: failed.sticker.id, url: failed.sticker.url, name: failed.sticker.name || failed.sticker.originalName || "Sticker", isAnimated: Boolean(failed.sticker.isAnimated) }
        : failed.stickerEmoji
          ? { type: "emoji", emoji: failed.stickerEmoji }
          : null
    )
    setReplyTo(failed.replyTo ?? null)
    toast.info(getLocale() === "en-US" ? "Draft restored to the composer." : "已把失败消息恢复到输入框。")
  }, [])

  const discardMessage = useCallback((messageId: string) => {
    setMessages((current) => current.filter((item) => item.id !== messageId))
  }, [])

  const pickSticker = useCallback((pick: StickerPick) => {
    if (pick.type === "emoji") {
      setText((current) => `${current}${pick.emoji}`)
      return
    }
    setSticker(pick)
  }, [])

  return {
    friend,
    messages,
    hasOlder: Boolean(nextCursor),
    loading,
    loadingOlder,
    sending,
    text,
    files,
    sticker,
    replyTo,
    setText,
    setFiles,
    setSticker,
    setReplyTo,
    pickSticker,
    loadMessages,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    discardMessage,
  }
}

function AttachmentView({ attachment, mine, onPreview }: { attachment: ChatAttachment; mine: boolean; onPreview: (attachment: ChatAttachment) => void }) {
  const isImage = attachment.mimeType.startsWith("image/")
  if (isImage) {
    return (
      <button type="button" onClick={() => onPreview(attachment)} className="block max-w-full overflow-hidden rounded-[--radius-md] hover:opacity-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.downloadUrl} alt={attachment.originalName} className="block max-h-72 max-w-full object-contain" />
      </button>
    )
  }

  const extension = attachment.originalName.split(".").pop()?.toUpperCase() || "FILE"

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm ${mine ? "border-[#d5e2ff] bg-white" : "border-[--color-border] bg-white"}`}>
      <a href={attachment.downloadUrl} download={attachment.originalName} className="flex min-w-[220px] max-w-[280px] items-center gap-3 px-4 py-3 text-left hover:no-underline">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[--color-text-primary]">{attachment.originalName}</p>
          <p className="mt-1 text-xs text-[--color-text-muted]">{formatBytes(attachment.size)}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${mine ? "bg-[#e8f0ff] text-[#2563eb]" : "bg-[--color-bg-hover] text-[--color-text-secondary]"}`}>
          <div className="flex flex-col items-center gap-1">
            <FileIcon size={16} />
            <span className="text-[9px] font-semibold leading-none">{extension.slice(0, 4)}</span>
          </div>
        </div>
      </a>
    </div>
  )
}

function MessageActionPreview({ message, senderName }: { message: ChatMessage; senderName: string }) {
  return (
    <div className="space-y-2 p-3">
      <p className="truncate text-xs font-medium text-[--color-text-secondary]">{senderName}</p>
      {message.text ? <p className="whitespace-pre-wrap break-words text-sm text-[--color-text-primary]">{message.text}</p> : null}
      {message.stickerEmoji ? <p className="text-4xl leading-none">{message.stickerEmoji}</p> : null}
      {message.sticker ? (
        <div className="overflow-hidden rounded-xl bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.sticker.url} alt={message.sticker.name || message.sticker.originalName || "sticker"} className="block max-h-28 max-w-full object-contain" />
        </div>
      ) : null}
      {message.attachments.length > 0 ? (
        <div className="space-y-2">
          {message.attachments.map((attachment) => (
            attachment.mimeType.startsWith("image/") ? (
              <div key={attachment.id} className="overflow-hidden rounded-xl bg-white p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.downloadUrl} alt={attachment.originalName} className="block max-h-32 max-w-full object-contain" />
              </div>
            ) : (
              <div key={attachment.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ff] text-[#2563eb]">
                  <FileIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[--color-text-primary]">{attachment.originalName}</p>
                  <p className="text-xs text-[--color-text-muted]">{formatBytes(attachment.size)}</p>
                </div>
              </div>
            )
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ChatPanel({
  friend,
  currentUser,
  messages,
  loading,
  sending,
  hasOlder = false,
  loadingOlder = false,
  text,
  files,
  sticker,
  replyTo,
  onTextChange,
  onFilesChange,
  onStickerChange,
  onStickerPick,
  onReplyChange,
  onSend,
  onLoadOlder,
  onReload,
  onRetryMessage,
  onDiscardMessage,
  className = "",
  headerPrefix,
  headerActions,
  composerExtra,
  userId,
}: {
  friend: ChatFriend | null
  currentUser?: ChatFriend | null
  messages: ChatMessage[]
  loading: boolean
  sending: boolean
  hasOlder?: boolean
  loadingOlder?: boolean
  text: string
  files: File[]
  sticker?: StickerPick | null
  replyTo?: ReplyPreview | null
  onTextChange: (value: string) => void
  onFilesChange: (files: File[]) => void
  onStickerChange?: (sticker: StickerPick | null) => void
  onStickerPick?: (sticker: StickerPick) => void
  onReplyChange?: (reply: ReplyPreview | null) => void
  onSend: () => void
  onLoadOlder?: () => Promise<{ prependedIds?: string[] } | void> | { prependedIds?: string[] } | void
  onReload: () => void
  onRetryMessage?: (messageId: string) => void
  onDiscardMessage?: (messageId: string) => void
  className?: string
  headerPrefix?: ReactNode
  headerActions?: ReactNode
  composerExtra?: ReactNode
  userId?: string
}) {
  const labels = getLabels()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const loadOlderInFlightRef = useRef(false)
  const loadOlderSequenceRef = useRef(0)
  const suppressAutoLoadOlderUntilRef = useRef(0)
  const revealPrependedHistoryRef = useRef(false)
  const forceScrollToBottomRef = useRef(false)
  const [failedMessage, setFailedMessage] = useState<ChatMessage | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<ChatAttachment | null>(null)

  const scrollToLatestMessage = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const scroll = () => {
      container.scrollTop = container.scrollHeight
      shouldStickToBottomRef.current = true
    }
    scroll()
    window.requestAnimationFrame(scroll)
    window.setTimeout(scroll, 120)
    window.setTimeout(scroll, 360)
  }, [])

  const trailingMineMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.senderId === friend?.id) return null
      return message.id
    }
    return null
  }, [friend?.id, messages])

  useLayoutEffect(() => {
    lastMessageIdRef.current = null
    shouldStickToBottomRef.current = true
    forceScrollToBottomRef.current = Boolean(friend?.id)
    scrollToLatestMessage()
  }, [friend?.id, scrollToLatestMessage])

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const currentLastMessageId = messages[messages.length - 1]?.id ?? null
    if (revealPrependedHistoryRef.current) {
      revealPrependedHistoryRef.current = false
      lastMessageIdRef.current = currentLastMessageId
      container.scrollTop = 0
      return
    }
    const lastMessageChanged = lastMessageIdRef.current !== currentLastMessageId
    const latestMessage = messages[messages.length - 1]
    const latestMessageIsMine = latestMessage ? latestMessage.senderId !== friend?.id : false
    const shouldForce = forceScrollToBottomRef.current || lastMessageIdRef.current === null
    if (currentLastMessageId && lastMessageChanged && (shouldForce || shouldStickToBottomRef.current || latestMessageIsMine)) {
      forceScrollToBottomRef.current = false
      scrollToLatestMessage()
    } else if (forceScrollToBottomRef.current) {
      forceScrollToBottomRef.current = false
      scrollToLatestMessage()
    }
    lastMessageIdRef.current = currentLastMessageId
  }, [friend?.id, messages, scrollToLatestMessage])

  useEffect(() => {
    const container = scrollContainerRef.current
    const content = container?.firstElementChild
    if (!container || !content || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (forceScrollToBottomRef.current || shouldStickToBottomRef.current) scrollToLatestMessage()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [messages.length, loading, scrollToLatestMessage])

  const handleLoadOlder = useCallback(async () => {
    if (!onLoadOlder || loadingOlder || loadOlderInFlightRef.current) return
    loadOlderInFlightRef.current = true
    const requestSequence = ++loadOlderSequenceRef.current
    try {
      const result = await onLoadOlder()
      if (loadOlderSequenceRef.current !== requestSequence) return
      const prependedIds = result && "prependedIds" in result ? result.prependedIds ?? [] : []
      if (prependedIds.length > 0) {
        revealPrependedHistoryRef.current = true
      }
      suppressAutoLoadOlderUntilRef.current = Date.now() + 500
    } finally {
      loadOlderInFlightRef.current = false
    }
  }, [loadingOlder, onLoadOlder])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => {
      shouldStickToBottomRef.current = isNearBottom(container)
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [])

  const handleComposerPaste = useCallback((event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = getClipboardImageFiles(event.clipboardData)
    if (pastedFiles.length === 0) return
    event.preventDefault()
    onFilesChange([...files, ...pastedFiles])
  }, [files, onFilesChange])

  if (!friend) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-8 text-center ${className}`}>
        <p className="text-sm font-medium">{labels.chooseFriend}</p>
        <p className="mt-1 text-xs text-[--color-text-muted]">{labels.chooseFriendHint}</p>
      </div>
    )
  }

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[--color-border] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {headerPrefix}
          <button type="button" onClick={() => setProfileOpen(true)} className="shrink-0">
            <UserAvatar
              name={friend.displayName}
              email={friend.email}
              avatarText={friend.avatarText}
              avatarUrl={friend.avatarUrl}
              presenceStatus={friend.presenceStatus}
              size="sm"
            />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{friend.displayName || friend.email}</p>
            <p className="truncate text-xs text-[--color-text-muted]">{presenceLabel(friend.presenceStatus)} / {friend.email}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <Button type="button" size="sm" variant="outline" onClick={onReload} className="h-8 shrink-0 gap-1.5">
            <RefreshCcw size={13} />
            <span className="hidden sm:inline">{labels.refresh}</span>
          </Button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="mobile-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <ChatMessagesLoading />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[--color-text-muted]">{labels.noMessages}</p>
        ) : (
          <div className="space-y-3">
            {(hasOlder || loadingOlder) && (
              <div className="flex justify-center pb-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleLoadOlder()} disabled={loadingOlder} className="h-8 text-xs text-[--color-text-muted]">
                  {loadingOlder ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      {labels.loadingOlder}
                    </>
                  ) : labels.loadOlder}
                </Button>
              </div>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const mine = message.senderId !== friend.id
              const sender = message.sender ?? (mine ? (currentUser ?? { id: "self", email: "", displayName: labels.you, avatarText: "", avatarUrl: null }) : friend)
              const assetStickerOnly = !message.text && !message.stickerEmoji && Boolean(message.sticker) && message.attachments.length === 0
              const imageOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => attachment.mimeType.startsWith("image/"))
              const fileOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => !attachment.mimeType.startsWith("image/"))
              const attachmentOnly = imageOnly || fileOnly
              const hasLeadingContent = Boolean(message.text || message.stickerEmoji || message.sticker)
              const showReadStatus = mine && trailingMineMessageId === message.id && !message.localStatus
              const primaryImage = getPrimaryImageAttachment(message)
              const addStickerLabel = getLocale() === "en-US" ? "Add to My Stickers" : "添加到我的表情"
              const stickerSavedLabel = getLocale() === "en-US" ? "Saved to your custom stickers." : "已添加到我的表情"
              const downloadImageLabel = getLocale() === "en-US" ? "Download Image" : "下载图片"
              const copyImageLabel = getLocale() === "en-US" ? "Copy Image" : "复制图片"
              const copyImageSuccessLabel = getLocale() === "en-US" ? "Image copied. You can paste it into the composer." : "图片已复制，可直接粘贴到输入框"
              const copyImageFailedLabel = getLocale() === "en-US" ? "Image copy failed" : "复制图片失败"
              const quoteLabel = getLocale() === "en-US" ? "Quote" : "引用"
              const copyLabel = labels.copy ?? "复制"
              const copiedLabel = labels.copied ?? "已复制"
              const copyFailedLabel = labels.copyFailed ?? "复制失败"
              const replySummary = message.replyTo ? getReplySummary(message.replyTo) : ""
              const actionPreview = <MessageActionPreview message={message} senderName={sender.displayName || sender.email || labels.you} />
              const actionItems: MessageActionItem[] = [
                {
                  id: "reply",
                  label: quoteLabel,
                  onSelect: () => onReplyChange?.(messageToReplyPreview(message, sender)),
                },
                {
                  id: "copy",
                  label: copyLabel,
                  onSelect: async () => {
                    const copyText = getMessageCopyText(message)
                    if (!copyText) return
                    try {
                      await navigator.clipboard.writeText(copyText)
                      toast.success(copiedLabel)
                    } catch {
                      toast.error(copyFailedLabel)
                    }
                  },
                },
              ]
              if (message.sticker?.id && userId) {
                actionItems.splice(1, 0, {
                  id: "save-sticker",
                  label: addStickerLabel,
                  onSelect: async () => {
                    try {
                      await saveStickerToCustomLibrary(message.sticker!.id, userId)
                      toast.success(stickerSavedLabel)
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : copyFailedLabel)
                    }
                  },
                })
              }
              if (primaryImage) {
                actionItems.splice(actionItems.length - 1, 0,
                  {
                    id: "download-image",
                    label: downloadImageLabel,
                    onSelect: () => triggerBrowserDownload(primaryImage.downloadUrl, primaryImage.originalName),
                  },
                  {
                    id: "copy-image",
                    label: copyImageLabel,
                    onSelect: async () => {
                      try {
                        await copyImageToClipboard(primaryImage.downloadUrl)
                        toast.success(copyImageSuccessLabel)
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : copyImageFailedLabel)
                      }
                    },
                  }
                )
              }
              const bubbleContent = (
                <>
                  {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                  {message.stickerEmoji && <p className="text-5xl leading-none">{message.stickerEmoji}</p>}
                  {message.sticker && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.sticker.url} alt={message.sticker.name || message.sticker.originalName || "sticker"} className={assetStickerOnly ? "max-h-36 max-w-36 object-contain" : "max-h-32 max-w-32 object-contain"} />
                  )}
                  {message.attachments.length > 0 && (
                    <div className={hasLeadingContent ? "mt-2 space-y-2" : "space-y-2"}>
                      {message.attachments.map((attachment) => (
                        <AttachmentView key={attachment.id} attachment={attachment} mine={mine} onPreview={setPreviewImage} />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[--color-text-muted]">
                    <div className="flex items-center gap-2">
                      {message.localStatus === "sending" && (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" />
                          {message.progress ?? 0}%
                        </span>
                      )}
                      {message.localStatus === "failed" && (
                        <button type="button" onClick={() => setFailedMessage(message)} className="inline-flex items-center text-[--color-danger]" title={labels.sendingFailed}>
                          <AlertCircle size={14} />
                        </button>
                      )}
                    </div>
                    {showReadStatus ? <span>{message.readAt ? labels.read : labels.delivered}</span> : <span />}
                  </div>
                </>
              )

              return (
                <div key={message.id} data-message-id={message.id}>
                  {shouldShowTime(previous, message) && (
                    <p className="my-4 text-center font-mono text-xs text-[--color-text-muted]">{formatTime(message.createdAt)}</p>
                  )}
                  <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                      <button type="button" onClick={() => setProfileOpen(true)} className="shrink-0">
                        <UserAvatar size="sm" name={sender.displayName} email={sender.email} avatarText={sender.avatarText} avatarUrl={sender.avatarUrl} />
                      </button>
                    )}
                    <div className={`flex max-w-[84%] flex-col ${mine ? "items-end" : "items-start"}`}>
                      <MessageActionSurface className={(assetStickerOnly || attachmentOnly) ? "group relative max-w-full" : `wechat-bubble group relative max-w-full px-3 py-2 text-[--color-text-primary] ${mine ? "wechat-bubble-right" : "wechat-bubble-left"}`} items={actionItems} preview={actionPreview}>
                        {bubbleContent}
                      </MessageActionSurface>
                      {message.replyTo && replySummary ? (
                        <MessageReplyReference
                          sender={message.replyTo.sender?.displayName || message.replyTo.sender?.email || labels.you}
                          summary={replySummary}
                          align={mine ? "right" : "left"}
                        />
                      ) : null}
                    </div>
                    {mine && (
                      <UserAvatar size="sm" name={sender.displayName} email={sender.email} avatarText={sender.avatarText} avatarUrl={sender.avatarUrl} />
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        className="wechat-composer shrink-0 p-3 pb-[5px]"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            onFilesChange([...files, ...Array.from(event.target.files ?? [])])
            event.currentTarget.value = ""
          }}
        />
        <div className="wechat-composer-panel flex flex-col">
          <ChatComposerAttachments
            files={files}
            sticker={sticker}
            fileLabel={labels.attachment}
            onRemoveFile={(index) => onFilesChange(files.filter((_, i) => i !== index))}
            onRemoveSticker={() => onStickerChange?.(null)}
          />
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => handleEnterToSubmit(event, onSend, { disabled: sending || (!text.trim() && files.length === 0 && !sticker) })}
            onPaste={handleComposerPaste}
            placeholder={labels.typeMessage}
            rows={3}
            className="wechat-composer-input max-h-32 flex-1 resize-none px-3 py-3 text-sm text-[--color-text-primary]"
          />
          {replyTo ? (
            <ComposerReplyPreview
              sender={replyTo.sender?.displayName || replyTo.sender?.email || labels.you}
              summary={getReplySummary(replyTo)}
              onClear={() => onReplyChange?.(null)}
            />
          ) : null}
          <div className="flex items-center gap-1 px-3 pb-3">
            <StickerPicker userId={userId} onPick={(pick) => onStickerPick ? onStickerPick(pick) : onStickerChange?.(pick)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="h-9 w-9 shrink-0 px-0 text-[--color-text-secondary] hover:bg-[#ededed]">
              <Paperclip size={18} />
            </Button>
            {composerExtra}
            <div className="flex-1" />
            <Button
              type="submit"
              size="sm"
              disabled={sending || (!text.trim() && files.length === 0 && !sticker)}
              onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, onSend)}
              className="h-9 shrink-0 rounded-md bg-[#f0f0f0] px-5 text-sm font-normal text-[#9b9b9b] shadow-none hover:bg-[#e8e8e8] enabled:bg-[#3b82f6] enabled:text-white"
            >
              <Send size={14} className="sm:hidden" />
              <span>{sending ? labels.sending : labels.send}</span>
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={Boolean(failedMessage)} onOpenChange={(open) => !open && setFailedMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.sendingFailed}</DialogTitle>
            <DialogDescription>{failedMessage?.error ?? labels.sendingFailed}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (failedMessage) onDiscardMessage?.(failedMessage.id)
                setFailedMessage(null)
              }}
            >
              {labels.discardFailed}
            </Button>
            <Button
              onClick={() => {
                if (failedMessage) onRetryMessage?.(failedMessage.id)
                setFailedMessage(null)
              }}
            >
              {labels.retrySend}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <UserAvatar
                size="sm"
                name={friend.displayName}
                email={friend.email}
                avatarText={friend.avatarText}
                avatarUrl={friend.avatarUrl}
                presenceStatus={friend.presenceStatus}
              />
              <span>{friend.displayName || friend.email}</span>
            </DialogTitle>
            <DialogDescription>{presenceLabel(friend.presenceStatus)} / {friend.email}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild variant="outline">
              <Link href={publicProfileHref(friend)}>{labels.viewProfile}</Link>
            </Button>
            <Button asChild>
              <Link href={`/friends?type=direct&id=${encodeURIComponent(friend.id)}`}>{labels.openChatPage}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[min(96vw,960px)] gap-0 overflow-hidden p-2 sm:p-3">
          {previewImage && (
            <div className="flex max-h-[92vh] items-center justify-center overflow-auto rounded-[--radius-lg]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage.downloadUrl} alt={previewImage.originalName} className="block max-h-[88vh] max-w-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CornerUpLeft,
  Download,
  File as FileIcon,
  Loader2,
  Paperclip,
  RefreshCcw,
  Reply,
  Send,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { setActiveChatContext } from "@/lib/active-chat"

export interface ChatFriend {
  id: string
  email: string
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

export type ReplyPreview = {
  id: string
  senderId: string
  text: string
  stickerEmoji?: string | null
  sticker?: { id: string; url: string; name?: string; originalName?: string; isAnimated?: boolean } | null
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
  sticker?: { id: string; url: string; name?: string; originalName?: string; isAnimated?: boolean } | null
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
  originalImage: string
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
      originalImage: "Send original image",
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
    originalImage: "发送原图",
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
  }
}

const IMAGE_MAX_EDGE = 1600
const IMAGE_QUALITY = 0.82
const TIME_GAP_MS = 5 * 60 * 1000
const HISTORY_BATCH_SIZE = 100
const HISTORY_AUTO_TARGET = 240

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

function fileTypeLabel(file: Pick<File, "name" | "type">) {
  const labels = getLabels()
  if (file.type.startsWith("image/")) return labels.image
  const ext = file.name.split(".").pop()?.toUpperCase()
  return ext ? `${ext}` : labels.attachment
}

async function compressImageIfNeeded(file: File, sendOriginal: boolean) {
  if (sendOriginal) return file
  if (!file.type.startsWith("image/")) return file
  if (file.type === "image/gif" || file.type === "image/png") return file

  const image = await createImageBitmap(file).catch(() => null)
  if (!image) return file

  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.width, image.height))
  if (scale >= 1) {
    image.close()
    return file
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext("2d")
  if (!context) {
    image.close()
    return file
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY))
  if (!blob || blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, "") || "image"
  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
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

export function useChatSession(friendId: string | null, initialFriend?: ChatFriend | null, onSummaryChange?: () => void, _userId?: string) {
  const [loadedFriend, setLoadedFriend] = useState<ChatFriend | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null)
  const [sendOriginal, setSendOriginal] = useState(false)
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
      const params = new URLSearchParams({
        limit: String(HISTORY_BATCH_SIZE),
        _t: String(Date.now()),
      })
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/chats/${friendId}/messages?${params.toString()}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Failed to load chat")
      const items = Array.isArray(data.items) ? (data.items as ChatMessage[]) : []
      const incomingNextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null
      setLoadedFriend((data.friend as ChatFriend | null) ?? null)
      setNextCursor(incomingNextCursor)
      if (appendOlder) {
        setMessages((current) => {
          const existingIds = new Set(current.map((item) => item.id))
          const olderItems = items.filter((item) => !existingIds.has(item.id))
          return [...olderItems, ...current]
        })
      } else {
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
    if (!nextCursorRef.current || loading || loadingOlder) return
    const targetCount = messagesRef.current.filter((item) => !item.localStatus).length + HISTORY_AUTO_TARGET
    let cursor = nextCursorRef.current
    let loops = 0
    let keepGoing = true
    while (cursor && keepGoing && loops < 4) {
      loops += 1
      const previousCount = messagesRef.current.length
      await loadMessages({ cursor, appendOlder: true })
      cursor = nextCursorRef.current
      const currentCount = messagesRef.current.length
      keepGoing = currentCount < targetCount && currentCount > previousCount
    }
  }, [loadMessages, loading, loadingOlder])

  useEffect(() => {
    if (!friendId) return
    setMessages([])
    setFiles([])
    setSticker(null)
    setReplyTo(null)
    setNextCursor(null)
    void loadMessages()
  }, [friendId, loadMessages])

  useEffect(() => {
    if (!friendId) return
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      void loadMessages()
    }
    const onFocus = () => refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh()
    }
    const interval = window.setInterval(refresh, 60_000)

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [friendId, loadMessages])

  useEffect(() => {
    if (!friendId) return
    const source = new EventSource(`/api/chats/${friendId}/events`)
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage
      setMessages((current) => mergeChatMessages(current, [message]))
      onSummaryChange?.()
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
    })
    source.onerror = () => {
      void loadMessages()
    }
    return () => source.close()
  }, [friendId, loadMessages, onSummaryChange])

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
    const localId = `local-${crypto.randomUUID()}`
    const localFiles = files.map((file, index) => ({
      id: `${localId}-file-${index}`,
      originalName: file.name || "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      downloadUrl: URL.createObjectURL(file),
    }))
    const localMessage: ChatMessage = {
      id: localId,
      senderId: "self",
      receiverId: friendId,
      text: draftText,
      readAt: null,
      createdAt: new Date().toISOString(),
      stickerId: sticker?.type === "asset" ? sticker.id : null,
      stickerEmoji: sticker?.type === "emoji" ? sticker.emoji : null,
      sticker: sticker?.type === "asset" ? { id: sticker.id, url: sticker.url, name: sticker.name } : null,
      replyTo,
      attachments: localFiles,
      localStatus: "sending",
      progress: 0,
    }
    setMessages((current) => [...current, localMessage])

    try {
      const preparedFiles = await Promise.all(files.map((file) => compressImageIfNeeded(file, sendOriginal)))
      const uploaded = await uploadMessage({
        friendId,
        text: draftText,
        files: preparedFiles,
        sticker,
        replyToId: replyTo?.id ?? null,
        onProgress: (progress) => {
          setMessages((current) => current.map((item) => (item.id === localId ? { ...item, progress } : item)))
        },
      })
      setMessages((current) => current.map((item) => (item.id === localId ? uploaded : item)))
      setText("")
      setFiles([])
      setSticker(null)
      setReplyTo(null)
      onSummaryChange?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed"
      setMessages((current) => current.map((item) => (item.id === localId ? { ...item, localStatus: "failed", error: message, progress: 0 } : item)))
      toast.error(message)
    } finally {
      setSending(false)
    }
  }, [files, friend, friendId, onSummaryChange, replyTo, sendOriginal, sending, sticker, text])

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
    sendOriginal,
    sticker,
    replyTo,
    setText,
    setFiles,
    setSendOriginal,
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

function DraftFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const previewUrl = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-hover] p-2">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[--radius-sm] bg-white">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <FileIcon size={18} className="text-[--color-text-muted]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[--color-text-primary]">{file.name || "file"}</p>
        <p className="text-[10px] text-[--color-text-muted]">{fileTypeLabel(file)} / {formatBytes(file.size)}</p>
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 text-[--color-text-muted] hover:text-[--color-danger]">
        <X size={14} />
      </button>
    </div>
  )
}

function AttachmentView({ attachment, mine, onPreview }: { attachment: ChatAttachment; mine: boolean; onPreview: (attachment: ChatAttachment) => void }) {
  const isImage = attachment.mimeType.startsWith("image/")
  if (isImage) {
    return (
      <button type="button" onClick={() => onPreview(attachment)} className="block max-w-full overflow-hidden rounded-[--radius-md] hover:opacity-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.downloadUrl} alt={attachment.originalName} className="max-h-72 max-w-full object-contain" />
      </button>
    )
  }

  return (
    <div className={`overflow-hidden rounded border ${mine ? "border-[#d5e2ff] bg-white" : "border-[--color-border] bg-[--color-bg-hover]"}`}>
      <a href={attachment.downloadUrl} className="flex items-center gap-2 px-2 py-2 text-xs text-[--color-link] hover:no-underline">
        <FileIcon size={14} />
        <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
        <span>{formatBytes(attachment.size)}</span>
        <Download size={14} />
      </a>
    </div>
  )
}

function ReplyChip({ reply }: { reply: ReplyPreview }) {
  return (
    <div className="mb-2 rounded-lg border border-[--color-border] bg-black/5 px-3 py-2 text-xs text-[--color-text-secondary]">
      <p className="font-medium text-[--color-text-primary]">{reply.sender?.displayName || reply.sender?.email || getLabels().you}</p>
      <p className="truncate">{getReplySummary(reply)}</p>
    </div>
  )
}

export function ChatPanel({
  friend,
  messages,
  loading,
  sending,
  hasOlder = false,
  loadingOlder = false,
  text,
  files,
  sticker,
  sendOriginal = false,
  replyTo,
  onTextChange,
  onFilesChange,
  onStickerChange,
  onStickerPick,
  onSendOriginalChange,
  onReplyChange,
  onSend,
  onLoadOlder,
  onReload,
  onRetryMessage,
  onDiscardMessage,
  className = "",
  headerPrefix,
  userId,
}: {
  friend: ChatFriend | null
  messages: ChatMessage[]
  loading: boolean
  sending: boolean
  hasOlder?: boolean
  loadingOlder?: boolean
  text: string
  files: File[]
  sticker?: StickerPick | null
  sendOriginal?: boolean
  replyTo?: ReplyPreview | null
  onTextChange: (value: string) => void
  onFilesChange: (files: File[]) => void
  onStickerChange?: (sticker: StickerPick | null) => void
  onStickerPick?: (sticker: StickerPick) => void
  onSendOriginalChange?: (value: boolean) => void
  onReplyChange?: (reply: ReplyPreview | null) => void
  onSend: () => void
  onLoadOlder?: () => Promise<void> | void
  onReload: () => void
  onRetryMessage?: (messageId: string) => void
  onDiscardMessage?: (messageId: string) => void
  className?: string
  headerPrefix?: ReactNode
  userId?: string
}) {
  const labels = getLabels()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const [failedMessage, setFailedMessage] = useState<ChatMessage | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<ChatAttachment | null>(null)
  const hasImageDraft = useMemo(() => files.some((file) => file.type.startsWith("image/")), [files])

  const trailingMineMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.senderId === friend?.id) return null
      return message.id
    }
    return null
  }, [friend?.id, messages])

  useEffect(() => {
    const currentLastMessageId = messages[messages.length - 1]?.id ?? null
    if (!friend?.id) {
      lastMessageIdRef.current = currentLastMessageId
      return
    }
    if (lastMessageIdRef.current !== currentLastMessageId) {
      endRef.current?.scrollIntoView({ block: "end" })
    }
    lastMessageIdRef.current = currentLastMessageId
  }, [friend?.id, messages])

  const handleLoadOlder = useCallback(async () => {
    if (!onLoadOlder || loadingOlder) return
    const container = scrollContainerRef.current
    const previousHeight = container?.scrollHeight ?? 0
    const previousTop = container?.scrollTop ?? 0
    await onLoadOlder()
    window.requestAnimationFrame(() => {
      if (!container) return
      container.scrollTop = Math.max(0, container.scrollHeight - previousHeight + previousTop)
    })
  }, [loadingOlder, onLoadOlder])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !hasOlder || loading || loadingOlder) return

    const onScroll = () => {
      if (container.scrollTop > 80) return
      void handleLoadOlder()
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [handleLoadOlder, hasOlder, loading, loadingOlder])

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
        <Button type="button" size="sm" variant="outline" onClick={onReload} className="h-8 shrink-0 gap-1.5">
          <RefreshCcw size={13} />
          <span className="hidden sm:inline">{labels.refresh}</span>
        </Button>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-[--color-text-muted]">{labels.loading}</p>
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
              const sender = message.sender ?? (mine ? { id: "self", email: "", displayName: labels.you, avatarText: "", avatarUrl: null } : friend)
              const assetStickerOnly = !message.text && !message.stickerEmoji && Boolean(message.sticker) && message.attachments.length === 0
              const imageOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => attachment.mimeType.startsWith("image/"))
              const showReadStatus = mine && trailingMineMessageId === message.id && !message.localStatus
              const bubbleContent = (
                <>
                  {message.replyTo ? <ReplyChip reply={message.replyTo} /> : null}
                  {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                  {message.stickerEmoji && <p className="text-5xl leading-none">{message.stickerEmoji}</p>}
                  {message.sticker && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.sticker.url} alt={message.sticker.name || message.sticker.originalName || "sticker"} className={assetStickerOnly ? "max-h-36 max-w-36 object-contain" : "max-h-32 max-w-32 object-contain"} />
                  )}
                  {message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachments.map((attachment) => (
                        <AttachmentView key={attachment.id} attachment={attachment} mine={mine} onPreview={setPreviewImage} />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[--color-text-muted]">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onReplyChange?.({
                        id: message.id,
                        senderId: message.senderId,
                        text: message.text,
                        stickerEmoji: message.stickerEmoji,
                        sticker: message.sticker,
                        sender,
                        attachments: message.attachments,
                      })} className="inline-flex items-center gap-1 hover:text-[--color-link]">
                        <Reply size={12} />
                        <span>{labels.reply}</span>
                      </button>
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

              const startLongPress = () => {
                const timer = window.setTimeout(() => {
                  onReplyChange?.({
                    id: message.id,
                    senderId: message.senderId,
                    text: message.text,
                    stickerEmoji: message.stickerEmoji,
                    sticker: message.sticker,
                    sender,
                    attachments: message.attachments,
                  })
                }, 450)
                return timer
              }

              return (
                <div key={message.id}>
                  {shouldShowTime(previous, message) && (
                    <p className="my-4 text-center font-mono text-xs text-[--color-text-muted]">{formatTime(message.createdAt)}</p>
                  )}
                  <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                      <button type="button" onClick={() => setProfileOpen(true)} className="shrink-0">
                        <UserAvatar size="sm" name={sender.displayName} email={sender.email} avatarText={sender.avatarText} avatarUrl={sender.avatarUrl} />
                      </button>
                    )}
                    <div
                      className={(assetStickerOnly || imageOnly) ? "group relative max-w-[84%]" : `wechat-bubble group relative max-w-[84%] px-3 py-2 text-[--color-text-primary] ${mine ? "wechat-bubble-right" : "wechat-bubble-left"}`}
                      onPointerDown={() => {
                        const timer = startLongPress()
                        const clear = () => {
                          window.clearTimeout(timer)
                          window.removeEventListener("pointerup", clear)
                          window.removeEventListener("pointercancel", clear)
                        }
                        window.addEventListener("pointerup", clear)
                        window.addEventListener("pointercancel", clear)
                      }}
                    >
                      {bubbleContent}
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

      {files.length > 0 && (
        <div className="max-h-44 shrink-0 overflow-y-auto border-t border-[--color-border] bg-[--color-bg-surface] px-3 py-2 sm:px-4">
          {hasImageDraft && (
            <button
              type="button"
              onClick={() => onSendOriginalChange?.(!sendOriginal)}
              className={`mb-2 inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[--color-link] ${sendOriginal ? "text-[--color-link]" : "text-[--color-text-muted]"}`}
            >
              {sendOriginal ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {labels.originalImage}
            </button>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {files.map((file, index) => (
              <DraftFilePreview
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                onRemove={() => onFilesChange(files.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        </div>
      )}

      {replyTo ? (
        <div className="shrink-0 border-t border-[--color-border] bg-[--color-bg-surface] px-3 py-2 sm:px-4">
          <div className="flex items-start justify-between gap-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-hover] px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[--color-text-primary]">{labels.replyingTo} {replyTo.sender?.displayName || replyTo.sender?.email || labels.you}</p>
              <p className="truncate text-xs text-[--color-text-secondary]">{getReplySummary(replyTo)}</p>
            </div>
            <button type="button" onClick={() => onReplyChange?.(null)} className="shrink-0 text-[--color-text-muted] hover:text-[--color-danger]">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {sticker?.type === "asset" && (
        <div className="shrink-0 border-t border-[--color-border] px-3 py-2 sm:px-4">
          <span className="inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-hover] px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain" />
            <button type="button" onClick={() => onStickerChange?.(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      <form
        className="wechat-composer shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onFocus={() => window.setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 80)}
            placeholder={labels.typeMessage}
            rows={3}
            className="wechat-composer-input max-h-32 flex-1 resize-none px-3 py-3 text-sm text-[--color-text-primary]"
          />
          <div className="flex items-center gap-1 px-3 pb-3">
            <StickerPicker userId={userId} onPick={(pick) => onStickerPick ? onStickerPick(pick) : onStickerChange?.(pick)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="h-9 w-9 shrink-0 px-0 text-[--color-text-secondary] hover:bg-[#ededed]">
              <Paperclip size={18} />
            </Button>
            <div className="flex-1" />
            <Button type="submit" size="sm" disabled={sending || (!text.trim() && files.length === 0 && !sticker)} className="h-9 shrink-0 rounded-md bg-[#f0f0f0] px-5 text-sm font-normal text-[#9b9b9b] shadow-none hover:bg-[#e8e8e8] enabled:bg-[#3b82f6] enabled:text-white">
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
              <Link href={`/u/${friend.id}`}>{labels.viewProfile}</Link>
            </Button>
            <Button asChild>
              <Link href={`/friends/chat/${friend.id}`}>{labels.openChatPage}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[min(92vw,920px)]">
          <DialogHeader>
            <DialogTitle>{previewImage?.originalName || labels.imagePreview}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-[--radius-md] bg-black/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage.downloadUrl} alt={previewImage.originalName} className="max-h-[72vh] max-w-full object-contain" />
            </div>
          )}
          <DialogFooter>
            <Button asChild variant="outline">
              <a href={previewImage?.downloadUrl} download={previewImage?.originalName}>
                <Download size={14} /> Download
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

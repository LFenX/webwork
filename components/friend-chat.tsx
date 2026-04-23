"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Circle, Download, File as FileIcon, Loader2, Paperclip, RefreshCcw, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { deleteChatOutboxItem, listChatOutboxItems, saveChatOutboxItem, type ChatOutboxItem } from "@/lib/chat-outbox"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

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
  attachments: ChatAttachment[]
  localStatus?: "sending" | "failed"
  progress?: number
  error?: string
}

export type ChatSummary = {
  friendId: string
  unreadCount: number
  latest: { text: string; createdAt: string; hasAttachment: boolean } | null
}

type PendingDraft = {
  text: string
  file: File | null
  sendOriginal: boolean
  sticker?: StickerPick | null
  clientMutationId?: string
}

const IMAGE_MAX_EDGE = 1600
const IMAGE_QUALITY = 0.82
const TIME_GAP_MS = 5 * 60 * 1000
const INPUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const PRESENCE_REFRESH_MS = 60_000

export function presenceLabel(status?: ChatFriend["presenceStatus"]) {
  if (status === "online") return "在线"
  if (status === "away") return "离开"
  return "离线"
}

export function messagePreview(summary?: ChatSummary) {
  if (!summary?.latest) return "还没有聊天记录"
  const text = summary.latest.text || (summary.latest.hasAttachment ? "附件" : "")
  return text.length > 32 ? `${text.slice(0, 32)}...` : text
}

function formatTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })

  if (diffDays <= 0) return time
  if (diffDays < 7) return `${date.toLocaleDateString("zh-CN", { weekday: "short" })} ${time}`
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
  if (file.type.startsWith("image/")) return "图片"
  const ext = file.name.split(".").pop()?.toUpperCase()
  return ext ? `${ext} 文件` : "文件"
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

function uploadMessage({
  friendId,
  text,
  file,
  sticker,
  clientMutationId,
  onProgress,
}: {
  friendId: string
  text: string
  file: File | null
  sticker?: StickerPick | null
  clientMutationId?: string
  onProgress: (progress: number) => void
}) {
  return new Promise<ChatMessage>((resolve, reject) => {
    const form = new FormData()
    form.set("text", text)
    if (sticker?.type === "asset") form.set("stickerId", sticker.id)
    if (sticker?.type === "emoji") form.set("stickerEmoji", sticker.emoji)
    if (clientMutationId) form.set("clientMutationId", clientMutationId)
    if (file) form.append("files", file)

    const request = new XMLHttpRequest()
    request.open("POST", `/api/chats/${friendId}/messages`)
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    request.onload = () => {
      const data = JSON.parse(request.responseText || "{}")
      if (request.status >= 200 && request.status < 300) resolve(data as ChatMessage)
      else reject(new Error(data.error ?? "发送失败"))
    }
    request.onerror = () => reject(new Error("网络异常，发送失败"))
    request.send(form)
  })
}

function draftToLocalMessage(item: ChatOutboxItem, friendId: string): ChatMessage {
  return {
    id: item.id,
    senderId: "self",
    receiverId: friendId,
    text: item.text,
    readAt: null,
    createdAt: new Date(item.createdAt).toISOString(),
    stickerId: item.sticker?.type === "asset" ? item.sticker.id : null,
    stickerEmoji: item.sticker?.type === "emoji" ? item.sticker.emoji : null,
    sticker: item.sticker?.type === "asset" ? { id: item.sticker.id, url: item.sticker.url, name: item.sticker.name } : null,
    attachments: item.files.map((file, index) => ({
      id: `${item.id}-file-${index}`,
      originalName: file.name || "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      downloadUrl: URL.createObjectURL(file),
    })),
    localStatus: "failed",
    progress: 0,
    error: item.lastError ?? "消息未发送，可以重试或丢弃。",
  }
}

export function useChatSession(friendId: string | null, initialFriend?: ChatFriend | null, onSummaryChange?: () => void, userId?: string) {
  const [loadedFriend, setLoadedFriend] = useState<ChatFriend | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [sendOriginal, setSendOriginal] = useState(false)
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, PendingDraft>>({})
  const [activeUploads, setActiveUploads] = useState(0)
  const [loading, setLoading] = useState(false)
  const friend = initialFriend ?? loadedFriend
  const sending = activeUploads > 0
  const inputDraftKey = useMemo(
    () => userId && friendId ? userStorageKey(userId, "chat-input", `direct:${friendId}`) : "",
    [friendId, userId]
  )

  const loadMessages = useCallback(async () => {
    if (!friendId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/chats/${friendId}/messages?limit=50&_t=${Date.now()}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "加载聊天失败")
      let restoredDrafts: ChatOutboxItem[] = []
      if (userId) {
        restoredDrafts = await listChatOutboxItems(userId, "direct", friendId)
        setPendingDrafts(Object.fromEntries(restoredDrafts.map((item) => [item.id, {
          text: item.text,
          file: item.files[0] ?? null,
          sendOriginal: Boolean(item.sendOriginal),
          sticker: item.sticker ?? null,
          clientMutationId: item.clientMutationId,
        }])))
      }
      setLoadedFriend(data.friend ?? null)
      const items = Array.isArray(data.items) ? data.items : []
      setMessages([...items, ...restoredDrafts.map((item) => draftToLocalMessage(item, friendId))])
      onSummaryChange?.()
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载聊天失败")
    } finally {
      setLoading(false)
    }
  }, [friendId, onSummaryChange, userId])

  useEffect(() => {
    if (!friendId) return
    const timer = window.setTimeout(() => {
      setFiles([])
      setSticker(null)
      setPendingDrafts({})
      const savedText = inputDraftKey && userId
        ? readUserStorage<{ text: string }>({ kind: "session", key: inputDraftKey, userId, ttlMs: INPUT_DRAFT_TTL_MS })?.text ?? ""
        : ""
      setText(savedText)
      void loadMessages()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [friendId, inputDraftKey, loadMessages, userId])

  useEffect(() => {
    if (!friendId) return
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      void loadMessages()
    }
    const interval = window.setInterval(refresh, PRESENCE_REFRESH_MS)
    const onFocus = () => refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [friendId, loadMessages])

  useEffect(() => {
    if (!inputDraftKey || !userId) return
    if (!text) {
      removeUserStorage("session", inputDraftKey)
      return
    }
    writeUserStorage({ kind: "session", key: inputDraftKey, userId, value: { text } })
  }, [inputDraftKey, text, userId])

  useEffect(() => {
    if (!friendId) return
    const source = new EventSource(`/api/chats/${friendId}/events`)
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage
      if (message.senderId !== friendId) return
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]))
      onSummaryChange?.()
    })
    source.onerror = () => {
      void loadMessages()
    }
    return () => source.close()
  }, [friendId, loadMessages, onSummaryChange])

  const submitDraft = useCallback(async (draft: PendingDraft, localId: string) => {
    if (!friendId || !friend) return
    setActiveUploads((count) => count + 1)
    try {
      const preparedFile = draft.file ? await compressImageIfNeeded(draft.file, draft.sendOriginal) : null
      const uploaded = await uploadMessage({
        friendId,
        text: draft.text,
        file: preparedFile,
        sticker: draft.sticker,
        clientMutationId: draft.clientMutationId,
        onProgress: (progress) => {
          setMessages((current) => current.map((item) => (item.id === localId ? { ...item, progress } : item)))
        },
      })
      setMessages((current) => current.map((item) => (item.id === localId ? uploaded : item)))
      await deleteChatOutboxItem(localId)
      setPendingDrafts((current) => {
        const next = { ...current }
        delete next[localId]
        return next
      })
      onSummaryChange?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败"
      if (userId && friendId) {
        await saveChatOutboxItem({
          id: localId,
          clientMutationId: draft.clientMutationId ?? localId,
          userId,
          conversationType: "direct",
          conversationId: friendId,
          text: draft.text,
          sendOriginal: draft.sendOriginal,
          sticker: draft.sticker ?? null,
          files: draft.file ? [draft.file] : [],
          createdAt: Date.now(),
          lastError: message,
        }).catch((saveError) => {
          toast.error(saveError instanceof Error ? saveError.message : "保存本地重试消息失败")
        })
      }
      setMessages((current) => current.map((item) => (item.id === localId ? { ...item, localStatus: "failed", error: message, progress: 0 } : item)))
      toast.error(message)
    } finally {
      setActiveUploads((count) => Math.max(0, count - 1))
    }
  }, [friend, friendId, onSummaryChange, userId])

  const enqueueDraft = useCallback((draft: PendingDraft) => {
    if (!friendId) return
    const clientMutationId = draft.clientMutationId ?? crypto.randomUUID()
    const localId = draft.clientMutationId ? `local-${draft.clientMutationId}` : `local-${clientMutationId}`
    const attachment = draft.file
      ? [{
          id: `${localId}-file`,
          originalName: draft.file.name || "未命名文件",
          mimeType: draft.file.type || "application/octet-stream",
          size: draft.file.size,
          downloadUrl: URL.createObjectURL(draft.file),
        }]
      : []
    const localMessage: ChatMessage = {
      id: localId,
      senderId: "self",
      receiverId: friendId,
      text: draft.text,
      readAt: null,
      createdAt: new Date().toISOString(),
      stickerId: draft.sticker?.type === "asset" ? draft.sticker.id : null,
      stickerEmoji: draft.sticker?.type === "emoji" ? draft.sticker.emoji : null,
      sticker: draft.sticker?.type === "asset" ? { id: draft.sticker.id, url: draft.sticker.url, name: draft.sticker.name } : null,
      attachments: attachment,
      localStatus: "sending",
      progress: 0,
    }

    const pending = { ...draft, clientMutationId }
    setMessages((current) => [...current, localMessage])
    setPendingDrafts((current) => ({ ...current, [localId]: pending }))
    void submitDraft(pending, localId)
  }, [friendId, submitDraft])

  const sendMessage = useCallback(() => {
    if (!friendId || !friend || sending) return
    const draftText = text.trim()
    if (!draftText && files.length === 0 && !sticker) return

    if (draftText || sticker) enqueueDraft({ text: draftText, file: null, sendOriginal, sticker })
    files.forEach((file) => enqueueDraft({ text: "", file, sendOriginal }))
    if (inputDraftKey) removeUserStorage("session", inputDraftKey)
    setText("")
    setFiles([])
    setSticker(null)
  }, [enqueueDraft, files, friend, friendId, inputDraftKey, sendOriginal, sending, sticker, text])

  const pickSticker = useCallback((pick: StickerPick) => {
    if (pick.type === "emoji") {
      setText((current) => `${current}${pick.emoji}`)
      return
    }
    if (!friendId || !friend || sending) return
    enqueueDraft({ text: "", file: null, sendOriginal, sticker: pick })
  }, [enqueueDraft, friend, friendId, sendOriginal, sending])

  const retryMessage = useCallback((messageId: string) => {
    const draft = pendingDrafts[messageId]
    if (!draft) return
    setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, localStatus: "sending", error: undefined, progress: 0 } : item)))
    void submitDraft(draft, messageId)
  }, [pendingDrafts, submitDraft])

  const discardMessage = useCallback((messageId: string) => {
    setMessages((current) => current.filter((item) => item.id !== messageId))
    void deleteChatOutboxItem(messageId)
    setPendingDrafts((current) => {
      const next = { ...current }
      delete next[messageId]
      return next
    })
  }, [])

  return {
    friend,
    messages,
    loading,
    sending,
    text,
    files,
    sendOriginal,
    sticker,
    setText,
    setFiles,
    setSendOriginal,
    setSticker,
    pickSticker,
    loadMessages,
    sendMessage,
    retryMessage,
    discardMessage,
  }
}

export function ChatPanel({
  friend,
  messages,
  loading,
  sending,
  text,
  files,
  sticker,
  sendOriginal = false,
  onTextChange,
  onFilesChange,
  onStickerChange,
  onStickerPick,
  onSendOriginalChange,
  onSend,
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
  text: string
  files: File[]
  sticker?: StickerPick | null
  sendOriginal?: boolean
  onTextChange: (value: string) => void
  onFilesChange: (files: File[]) => void
  onStickerChange?: (sticker: StickerPick | null) => void
  onStickerPick?: (sticker: StickerPick) => void
  onSendOriginalChange?: (value: boolean) => void
  onSend: () => void
  onReload: () => void
  onRetryMessage?: (messageId: string) => void
  onDiscardMessage?: (messageId: string) => void
  className?: string
  headerPrefix?: React.ReactNode
  userId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [failedMessage, setFailedMessage] = useState<ChatMessage | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<ChatAttachment | null>(null)
  const hasImageDraft = useMemo(() => files.some((file) => file.type.startsWith("image/")), [files])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, friend?.id])

  if (!friend) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-8 text-center ${className}`}>
        <p className="text-sm font-medium">选择一个好友开始聊天</p>
        <p className="mt-1 text-xs text-[--color-text-muted]">可以发送文字、照片和任意类型文件。</p>
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
          <span className="hidden sm:inline">刷新</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-[--color-text-muted]">加载聊天记录中...</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[--color-text-muted]">还没有消息，发一句问候吧。</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const mine = message.senderId !== friend.id
              const sender = message.sender ?? (mine ? { id: "self", email: "", displayName: "我", avatarText: "", avatarUrl: null } : friend)
              const assetStickerOnly = !message.text && !message.stickerEmoji && Boolean(message.sticker) && message.attachments.length === 0
              const imageOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => attachment.mimeType.startsWith("image/"))
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
                  <div className={(assetStickerOnly || imageOnly) ? "group relative max-w-[84%]" : `wechat-bubble group relative max-w-[84%] px-3 py-2 text-[--color-text-primary] ${
                    mine ? "wechat-bubble-right" : "wechat-bubble-left"
                  }`}>
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
                    <div className="mt-1 flex items-center justify-end gap-2">
                      {message.localStatus === "sending" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[--color-text-muted]">
                          <Loader2 size={11} className="animate-spin" />
                          {message.progress ?? 0}%
                        </span>
                      )}
                      {message.localStatus === "failed" && (
                        <button
                          type="button"
                          onClick={() => setFailedMessage(message)}
                          className="inline-flex items-center text-[--color-danger]"
                          title="发送失败"
                        >
                          <AlertCircle size={14} />
                        </button>
                      )}
                    </div>
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
              原图
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
            placeholder="输入消息..."
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
              <span>{sending ? "发送中" : "发送"}</span>
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={Boolean(failedMessage)} onOpenChange={(open) => !open && setFailedMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发送失败</DialogTitle>
            <DialogDescription>{failedMessage?.error ?? "消息没有发送成功，可以重新发送或放弃。"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (failedMessage) onDiscardMessage?.(failedMessage.id)
                setFailedMessage(null)
              }}
            >
              放弃
            </Button>
            <Button
              onClick={() => {
                if (failedMessage) onRetryMessage?.(failedMessage.id)
                setFailedMessage(null)
              }}
            >
              重新发送
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
              <Link href={`/u/${friend.id}`}>主页</Link>
            </Button>
            <Button asChild>
              <Link href={`/friends/chat/${friend.id}`}>个人聊天</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[min(92vw,920px)]">
          <DialogHeader>
            <DialogTitle>{previewImage?.originalName || "图片预览"}</DialogTitle>
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
                <Download size={14} /> 下载
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DraftFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith("image/")
  const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage])

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
        <p className="truncate text-xs font-medium text-[--color-text-primary]">{file.name || "未命名文件"}</p>
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

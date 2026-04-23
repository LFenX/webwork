"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Circle, Download, File as FileIcon, Image as ImageIcon, Loader2, Paperclip, RefreshCcw, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserAvatar } from "@/components/user-avatar"

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
  readAt: string | null
  createdAt: string
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
}

const IMAGE_MAX_EDGE = 1600
const IMAGE_QUALITY = 0.82

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
  onProgress,
}: {
  friendId: string
  text: string
  file: File | null
  onProgress: (progress: number) => void
}) {
  return new Promise<ChatMessage>((resolve, reject) => {
    const form = new FormData()
    form.set("text", text)
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

export function useChatSession(friendId: string | null, initialFriend?: ChatFriend | null, onSummaryChange?: () => void) {
  const [loadedFriend, setLoadedFriend] = useState<ChatFriend | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sendOriginal, setSendOriginal] = useState(false)
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, PendingDraft>>({})
  const [activeUploads, setActiveUploads] = useState(0)
  const [loading, setLoading] = useState(false)
  const friend = initialFriend ?? loadedFriend
  const sending = activeUploads > 0

  const loadMessages = useCallback(async () => {
    if (!friendId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/chats/${friendId}/messages?limit=50&_t=${Date.now()}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "加载聊天失败")
      setLoadedFriend(data.friend ?? null)
      setMessages(Array.isArray(data.items) ? data.items : [])
      onSummaryChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载聊天失败")
    } finally {
      setLoading(false)
    }
  }, [friendId, onSummaryChange])

  useEffect(() => {
    if (!friendId) return
    const timer = window.setTimeout(() => {
      setFiles([])
      setText("")
      setPendingDrafts({})
      void loadMessages()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [friendId, loadMessages])

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
        onProgress: (progress) => {
          setMessages((current) => current.map((item) => (item.id === localId ? { ...item, progress } : item)))
        },
      })
      setMessages((current) => current.map((item) => (item.id === localId ? uploaded : item)))
      setPendingDrafts((current) => {
        const next = { ...current }
        delete next[localId]
        return next
      })
      onSummaryChange?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败"
      setMessages((current) => current.map((item) => (item.id === localId ? { ...item, localStatus: "failed", error: message, progress: 0 } : item)))
      toast.error(message)
    } finally {
      setActiveUploads((count) => Math.max(0, count - 1))
    }
  }, [friend, friendId, onSummaryChange])

  const enqueueDraft = useCallback((draft: PendingDraft) => {
    if (!friendId) return
    const localId = `local-${crypto.randomUUID()}`
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
      attachments: attachment,
      localStatus: "sending",
      progress: 0,
    }

    setMessages((current) => [...current, localMessage])
    setPendingDrafts((current) => ({ ...current, [localId]: draft }))
    void submitDraft(draft, localId)
  }, [friendId, submitDraft])

  const sendMessage = useCallback(() => {
    if (!friendId || !friend || sending) return
    const draftText = text.trim()
    if (!draftText && files.length === 0) return

    if (draftText) enqueueDraft({ text: draftText, file: null, sendOriginal })
    files.forEach((file) => enqueueDraft({ text: "", file, sendOriginal }))
    setText("")
    setFiles([])
  }, [enqueueDraft, files, friend, friendId, sendOriginal, sending, text])

  const retryMessage = useCallback((messageId: string) => {
    const draft = pendingDrafts[messageId]
    if (!draft) return
    setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, localStatus: "sending", error: undefined, progress: 0 } : item)))
    void submitDraft(draft, messageId)
  }, [pendingDrafts, submitDraft])

  const discardMessage = useCallback((messageId: string) => {
    setMessages((current) => current.filter((item) => item.id !== messageId))
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
    setText,
    setFiles,
    setSendOriginal,
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
  sendOriginal = false,
  onTextChange,
  onFilesChange,
  onSendOriginalChange,
  onSend,
  onReload,
  onRetryMessage,
  onDiscardMessage,
  className = "",
  headerPrefix,
}: {
  friend: ChatFriend | null
  messages: ChatMessage[]
  loading: boolean
  sending: boolean
  text: string
  files: File[]
  sendOriginal?: boolean
  onTextChange: (value: string) => void
  onFilesChange: (files: File[]) => void
  onSendOriginalChange?: (value: boolean) => void
  onSend: () => void
  onReload: () => void
  onRetryMessage?: (messageId: string) => void
  onDiscardMessage?: (messageId: string) => void
  className?: string
  headerPrefix?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [failedMessage, setFailedMessage] = useState<ChatMessage | null>(null)
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
          <UserAvatar
            name={friend.displayName}
            email={friend.email}
            avatarText={friend.avatarText}
            avatarUrl={friend.avatarUrl}
            presenceStatus={friend.presenceStatus}
            size="sm"
          />
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
            {messages.map((message) => {
              const mine = message.senderId !== friend.id
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`group relative max-w-[84%] rounded-[--radius-md] border px-3 py-2 shadow-sm ${
                    mine ? "border-[#d5e2ff] bg-[#f7faff] text-[--color-text-primary]" : "border-[--color-border] bg-[--color-bg-primary]"
                  }`}>
                    {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment) => (
                          <AttachmentView key={attachment.id} attachment={attachment} mine={mine} />
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
                      <p className="text-right font-mono text-[10px] text-[--color-text-muted]">
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
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

      <form
        className="flex shrink-0 gap-2 border-t border-[--color-border] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="h-9 shrink-0">
          <Paperclip size={14} />
        </Button>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onFocus={() => window.setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 80)}
          placeholder="输入消息..."
          rows={1}
          className="max-h-24 min-h-9 flex-1 resize-none rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2 text-sm outline-none focus:border-[--color-accent]"
        />
        <Button type="submit" size="sm" disabled={sending || (!text.trim() && files.length === 0)} className="h-9 shrink-0 gap-1.5">
          <Send size={14} />
          <span className="hidden sm:inline">{sending ? "发送中" : "发送"}</span>
        </Button>
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

function AttachmentView({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  const isImage = attachment.mimeType.startsWith("image/")
  return (
    <div className={`overflow-hidden rounded border ${mine ? "border-[#d5e2ff] bg-white" : "border-[--color-border] bg-[--color-bg-hover]"}`}>
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={attachment.downloadUrl} alt={attachment.originalName} className="max-h-56 w-full object-contain" />
      )}
      <a href={attachment.downloadUrl} className="flex items-center gap-2 px-2 py-2 text-xs text-[--color-link] hover:no-underline">
        {isImage ? <ImageIcon size={14} /> : <FileIcon size={14} />}
        <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
        <span>{formatBytes(attachment.size)}</span>
        <Download size={14} />
      </a>
    </div>
  )
}

"use client"

import Link from "next/link"
import { type ClipboardEvent as ReactClipboardEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { File as FileIcon, Loader2, Megaphone, Menu, MessageCircle, Paperclip, Plus, RefreshCcw, Send, Sparkles, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { ComposerReplyPreview, MessageActionSurface, MessageReplyReference, type MessageActionItem } from "@/components/chat-message-actions"
import { ChatComposerAttachments } from "@/components/chat-composer-attachments"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { GroupAvatar } from "@/components/group-avatar"
import { deleteChatOutboxItem, listChatOutboxItems, saveChatOutboxItem, type ChatOutboxItem } from "@/lib/chat-outbox"
import { copyImageToClipboard, getClipboardImageFiles, saveStickerToCustomLibrary, triggerBrowserDownload } from "@/lib/chat-media-actions"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { SoulWingReplyButton } from "@/components/chat/soulwing-reply-button"
import { SoulWingRoundtableClient } from "@/components/ai/soulwing-roundtable-client"
import { getDict, type AppLocale } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"

export type AnnouncementItem = {
  type?: "announcement" | "broadcast"
  id: string
  content: string
  source?: string
  fromWorldChannel?: boolean
  createdAt: string
  author: { id: string; email: string; displayName: string }
}

type Friend = {
  id: string
  email: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
}

export type Channel = {
  id: string
  type: string
  name: string
  announcement?: string
  ownerId?: string | null
  ownerName?: string | null
  currentUserRole?: "owner" | "member" | null
  members: Friend[]
}

function submitOnTouchBeforeKeyboardBlur(event: ReactPointerEvent<HTMLButtonElement>, submit: () => void) {
  if (event.pointerType === "mouse") return
  event.preventDefault()
  submit()
}

type ChannelAttachment = {
  id: string
  originalName: string
  mimeType: string
  size: number
  downloadUrl: string
}

type ChannelStickerAsset = {
  id: string
  url: string
  scope?: string
  name?: string
  originalName?: string
  mimeType?: string
  size?: number
  isAnimated?: boolean
}

type ChannelMessage = {
  id: string
  channelId: string
  senderId: string
  sender: Friend
  text: string
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: ChannelStickerAsset | null
  createdAt: string
  attachments: ChannelAttachment[]
  replyTo?: {
    id: string
    sender: Friend
    text: string
    stickerEmoji?: string | null
    sticker?: ChannelStickerAsset | null
    attachments: ChannelAttachment[]
  } | null
  localStatus?: "sending" | "failed"
}

export type ChannelSummary = {
  channelId: string
  totalCount: number
  latest: { id: string; text: string; createdAt: string } | null
}

const WORLD_CHANNEL_ID = "world"
const SOULWING_ROUNDTABLE_CHANNEL_ID = "soulwing-roundtable"
const CHANNEL_SEEN_STORAGE_NAMESPACE = "channel-seen-count"
const CHANNEL_SEEN_STORAGE_ID = "channels"
const CHANNEL_SEEN_COUNTS_CHANGED_EVENT = "channel-seen-counts-changed"
const CHANNEL_SELECTED_STORAGE_NAMESPACE = "channel-selected"
const CHANNEL_SELECTED_STORAGE_ID = "channels"
const INPUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const TIME_GAP_MS = 5 * 60 * 1000
const INITIAL_HISTORY_BATCH_SIZE = 40
const OLDER_HISTORY_BATCH_SIZE = 10
const BOTTOM_STICKY_THRESHOLD = 96
const CHANNEL_SUMMARY_TTL_MS = 30 * 24 * 60 * 60 * 1000
const noopWorldAnnouncement = () => {}

function getChannelSeenStorageKey(userId: string) {
  return userStorageKey(userId, CHANNEL_SEEN_STORAGE_NAMESPACE, CHANNEL_SEEN_STORAGE_ID)
}

function getSelectedChannelStorageKey(userId: string) {
  return userStorageKey(userId, CHANNEL_SELECTED_STORAGE_NAMESPACE, CHANNEL_SELECTED_STORAGE_ID)
}

function emitChannelSeenCountsChanged(value: Record<string, number>) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, { detail: value }))
}

function getTotalUnreadChannelCount(summaries: Record<string, ChannelSummary>, seenCounts: Record<string, number>) {
  return Object.values(summaries).reduce((sum, summary) => {
    if (!summary.channelId || summary.channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) return sum
    const seen = seenCounts[summary.channelId] ?? summary.totalCount
    return sum + Math.max(summary.totalCount - seen, 0)
  }, 0)
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

function makeChannelMessageCursor(message: Pick<ChannelMessage, "id" | "createdAt"> | null | undefined) {
  if (!message) return null
  return `${new Date(message.createdAt).toISOString()}|${message.id}`
}

function isEarlierChannelMessage(a: ChannelMessage | undefined, b: ChannelMessage | undefined) {
  if (!a || !b) return false
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  if (timeDiff !== 0) return timeDiff < 0
  return a.id < b.id
}

function formatChatTime(value: string) {
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

function shouldShowTime(previous: ChannelMessage | undefined, current: ChannelMessage) {
  if (!previous) return true
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > TIME_GAP_MS
}

function uploadChannelMessage({
  channelId,
  text,
  files,
  sticker,
  publishToAnnouncement,
  replyToId,
}: {
  channelId: string
  text: string
  files: File[]
  sticker?: StickerPick | null
  publishToAnnouncement: boolean
  replyToId?: string | null
}) {
  return new Promise<ChannelMessage>((resolve, reject) => {
    const form = new FormData()
    form.set("text", text)
    if (sticker?.type === "asset") form.set("stickerId", sticker.id)
    if (sticker?.type === "emoji") form.set("stickerEmoji", sticker.emoji)
    form.set("publishToAnnouncement", publishToAnnouncement ? "true" : "false")
    if (replyToId) form.set("replyToId", replyToId)
    files.forEach((file) => form.append("files", file))

    const request = new XMLHttpRequest()
    request.open("POST", `/api/channels/${channelId}/messages`)
    request.onload = () => {
      const data = JSON.parse(request.responseText || "{}")
      if (request.status >= 200 && request.status < 300) resolve(data as ChannelMessage)
      else reject(new Error(data.error ?? "发送失败"))
    }
    request.onerror = () => reject(new Error("Network error"))
    request.send(form)
  })
}

function outboxToChannelMessage(item: ChatOutboxItem, currentUser: Friend): ChannelMessage {
  return {
    id: item.id,
    channelId: item.conversationId,
    senderId: currentUser.id,
    sender: currentUser,
    text: item.text,
    stickerId: item.sticker?.type === "asset" ? item.sticker.id : null,
    stickerEmoji: item.sticker?.type === "emoji" ? item.sticker.emoji : null,
    sticker: item.sticker?.type === "asset" ? { id: item.sticker.id, url: item.sticker.url, name: item.sticker.name } : null,
    createdAt: new Date(item.createdAt).toISOString(),
    attachments: item.files.map((file, index) => ({
      id: `${item.id}-file-${index}`,
      originalName: file.name || "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      downloadUrl: URL.createObjectURL(file),
    })),
    replyTo: null,
    localStatus: "failed",
  }
}

function compareChannelMessages(a: ChannelMessage, b: ChannelMessage) {
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  if (timeDiff !== 0) return timeDiff
  return a.id.localeCompare(b.id)
}

function mergeChannelMessages(current: ChannelMessage[], incoming: ChannelMessage[]) {
  const byId = new Map()
  for (const message of current) byId.set(message.id, message)
  for (const message of incoming) {
    const existing = byId.get(message.id)
    byId.set(message.id, existing ? { ...existing, ...message } : message)
  }
  return [...byId.values()].sort(compareChannelMessages)
}

function getChannelReplySummary(reply?: ChannelMessage["replyTo"] | null) {
  if (!reply) return ""
  if (reply.text.trim()) return reply.text.trim()
  if (reply.stickerEmoji || reply.sticker) return "[Sticker]"
  if (reply.attachments.length > 0) return reply.attachments[0]?.originalName || "[Attachment]"
  return ""
}

function getChannelMessageCopyText(message: ChannelMessage) {
  if (message.text.trim()) return message.text.trim()
  if (message.stickerEmoji) return message.stickerEmoji
  if (message.sticker) return "[Sticker]"
  if (message.attachments.length > 0) return message.attachments.map((attachment) => attachment.originalName).join("\n")
  return ""
}

function getPrimaryChannelImageAttachment(message: ChannelMessage) {
  const imageAttachments = message.attachments.filter((attachment) => attachment.mimeType.startsWith("image/"))
  return imageAttachments.length === 1 ? imageAttachments[0] : null
}

export function AnnouncementChannelBar({
  initialAnnouncements,
  userId,
  currentUser,
  locale = "zh-CN",
}: {
  initialAnnouncements: AnnouncementItem[]
  userId: string
  currentUser: Friend
  locale?: AppLocale
}) {
  const dict = getDict()
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [historyAnnouncements, setHistoryAnnouncements] = useState<AnnouncementItem[]>([])
  const [broadcastHistory, setBroadcastHistory] = useState<AnnouncementItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const latest = announcements[0]
  const latestId = latest?.id
  const latestType = latest?.type ?? "announcement"
  const latestLabel = latestType === "broadcast" ? dict.admin.worldChannel : dict.home.announcement
  const [channelSummaries, setChannelSummaries] = useState<Record<string, ChannelSummary>>({})
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({})
  const channelSeenKey = getChannelSeenStorageKey(userId)
  const channelUnreadCount = getTotalUnreadChannelCount(channelSummaries, seenCounts)

  const persistSeenCounts = useCallback((value: Record<string, number>) => {
    writeUserStorage({ kind: "local", key: channelSeenKey, userId, value })
    emitChannelSeenCountsChanged(value)
  }, [channelSeenKey, userId])

  const loadChannelSummaries = useCallback(async () => {
    const res = await fetch("/api/channels/summary", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    const items = Array.isArray(data.items) ? data.items as ChannelSummary[] : []
    const byId = Object.fromEntries(items.map((item) => [item.channelId, item]))
    setChannelSummaries(byId)
    setSeenCounts((current) => {
      if (Object.keys(current).length > 0) return current
      const stored = readUserStorage<Record<string, number>>({
        kind: "local",
        key: channelSeenKey,
        userId,
        ttlMs: CHANNEL_SUMMARY_TTL_MS,
      })
      if (stored) return stored
      const initial = Object.fromEntries(items.map((item) => [item.channelId, item.totalCount]))
      persistSeenCounts(initial)
      return initial
    })
  }, [channelSeenKey, persistSeenCounts, userId])

  const refreshAnnouncements = useCallback(async () => {
    const res = await fetch("/api/announcement-feed", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    setAnnouncements(Array.isArray(data.items) ? data.items : [])
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const [announcementRes, broadcastRes] = await Promise.all([
        fetch("/api/announcements?history=1&limit=50", { cache: "no-store" }),
        fetch("/api/world-broadcasts?limit=50", { cache: "no-store" }),
      ])
      if (announcementRes.ok) {
        const data = await announcementRes.json()
        setHistoryAnnouncements(Array.isArray(data.items) ? data.items : [])
      }
      if (broadcastRes.ok) {
        const data = await broadcastRes.json()
        setBroadcastHistory(Array.isArray(data.items) ? data.items.map((item: AnnouncementItem) => ({ ...item, type: "broadcast" as const })) : [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!latestId) return
    const timer = window.setTimeout(() => {
      fetch(`/api/announcement-feed/${latestType}/${latestId}`, { method: "POST", cache: "no-store" })
        .then(() => {
          if (latestType === "broadcast") {
            setAnnouncements((current) => current.filter((item) => item.id !== latestId || (item.type ?? "announcement") !== latestType))
          } else {
            void refreshAnnouncements()
          }
        })
        .catch(() => null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [latestId, latestType, refreshAnnouncements])

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type === "announcement-feed:changed") void refreshAnnouncements()
    }
    window.addEventListener("app:realtime", handler)
    return () => window.removeEventListener("app:realtime", handler)
  }, [refreshAnnouncements])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadChannelSummaries(), 0)
    const timer = window.setInterval(() => void loadChannelSummaries(), 20_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [loadChannelSummaries])

  useEffect(() => {
    const onSeenCountsChanged = (event: Event) => {
      const next = (event as CustomEvent<Record<string, number>>).detail
      if (next && typeof next === "object") setSeenCounts(next)
    }
    const onRealtime = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type !== "channel:message") return
      const message = payload.data as ChannelMessage | undefined
      if (!message?.channelId || message.channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) return
      const nextTotal = (channelSummaries[message.channelId]?.totalCount ?? seenCounts[message.channelId] ?? 0) + 1
      setChannelSummaries((current) => ({
        ...current,
        [message.channelId]: {
          channelId: message.channelId,
          totalCount: nextTotal,
          latest: { id: message.id, text: message.text, createdAt: message.createdAt },
        },
      }))
      if (message.senderId === userId) {
        setSeenCounts((current) => {
          const next = { ...current, [message.channelId]: nextTotal }
          persistSeenCounts(next)
          return next
        })
      }
    }
    window.addEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeenCountsChanged)
    window.addEventListener("app:realtime", onRealtime)
    return () => {
      window.removeEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeenCountsChanged)
      window.removeEventListener("app:realtime", onRealtime)
    }
  }, [channelSummaries, persistSeenCounts, seenCounts, userId])

  async function hideLatest() {
    if (!latest) return
    setAnnouncements((current) => current.filter((item) => item.id !== latest.id))
    await fetch(`/api/announcement-feed/${latest.type ?? "announcement"}/${latest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: true }),
      cache: "no-store",
    }).catch(() => null)
  }

  return (
    <section className="mb-8 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <Button asChild size="sm" className="relative h-9 shrink-0 gap-1.5 md:hidden">
          <Link href="/friends?type=channel&id=world" className="!text-primary-foreground hover:!text-primary-foreground">
            <MessageCircle size={14} />
            {dict.channels.channels}
            {channelUnreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center font-mono text-[10px] leading-4 text-white">
                {channelUnreadCount > 99 ? "99+" : channelUnreadCount}
              </span>
            ) : null}
          </Link>
        </Button>
        <Button type="button" size="sm" onClick={() => setOpen(true)} className="relative hidden h-9 shrink-0 gap-1.5 md:inline-flex">
          <MessageCircle size={14} />
          {dict.channels.channels}
          {channelUnreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center font-mono text-[10px] leading-4 text-white">
              {channelUnreadCount > 99 ? "99+" : channelUnreadCount}
            </span>
          ) : null}
        </Button>
        <div className="min-w-0 flex-1 overflow-hidden">
          {latest ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex whitespace-nowrap text-sm text-[--color-text-secondary] [animation:announcement-marquee_18s_linear_infinite]">
                  <span className="mr-3 inline-flex w-24 shrink-0 items-center justify-end gap-1 text-[--color-warning]">
                    <Megaphone size={14} /> {latestLabel}
                  </span>
                  <span className="min-w-0">{latest.content}</span>
                </div>
              </div>
              <button type="button" onClick={hideLatest} className="shrink-0 text-[--color-text-muted] hover:text-[--color-text-primary]" title={dict.channels.hide}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <p className="truncate text-sm text-[--color-text-muted]">{dict.channels.noAnnouncement}</p>
          )}
        </div>
        <button type="button" onClick={() => { setHistoryOpen(true); void loadHistory() }} className="shrink-0 text-xs text-[--color-link] hover:text-[--color-accent]">
          {dict.channels.history}
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-[min(96vw,980px)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <SheetHeader className="border-b border-[--color-border] px-4 py-3">
            <SheetTitle className="text-base">{dict.channels.channels}</SheetTitle>
          </SheetHeader>
          <GroupChatClient userId={userId} currentUser={currentUser} locale={locale} onWorldAnnouncement={refreshAnnouncements} />
        </SheetContent>
      </Sheet>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dict.home.announcement}{dict.channels.history}</DialogTitle>
            <DialogDescription>{dict.home.announcements} / {dict.admin.worldChannel}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {historyAnnouncements.length === 0 && broadcastHistory.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">{dict.common.noData}</p>
            ) : null}
            {[...historyAnnouncements, ...broadcastHistory].map((item) => (
              <div key={`${item.type ?? "announcement"}-${item.id}`} className="rounded-[--radius-md] border border-[--color-border] p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                <p className="mt-2 text-xs text-[--color-text-muted]">
                  {formatChatTime(item.createdAt)} / {item.type === "broadcast" ? dict.admin.worldChannel : dict.admin.adminSource} / {item.author.displayName || item.author.email}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void loadHistory()} loading={historyLoading} loadingText={dict.common.loading}>{dict.common.refresh}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function GroupChatClient({
  userId,
  currentUser,
  locale = "zh-CN",
  onWorldAnnouncement = noopWorldAnnouncement,
  initialChannelId,
  initialRoundtableDiscussionId,
  hideSidebar = false,
  className = "",
  headerPrefix,
  headerActions,
}: {
  userId: string
  currentUser: Friend
  locale?: AppLocale
  onWorldAnnouncement?: () => void
  initialChannelId?: string
  initialRoundtableDiscussionId?: string
  hideSidebar?: boolean
  className?: string
  headerPrefix?: ReactNode
  headerActions?: ReactNode
}) {
  const dict = getDict()
  const [channels, setChannels] = useState<Channel[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [selectedId, setSelectedId] = useState(WORLD_CHANNEL_ID)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null)
  const [publishToAnnouncement, setPublishToAnnouncement] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [profileUser, setProfileUser] = useState<Friend | null>(null)
  const [previewImage, setPreviewImage] = useState<ChannelAttachment | null>(null)
  const [channelMenuOpen, setChannelMenuOpen] = useState(false)
  const [worldMembersOpen, setWorldMembersOpen] = useState(false)
  const [worldMembers, setWorldMembers] = useState<Friend[]>([])
  const [worldMembersLoading, setWorldMembersLoading] = useState(false)
  const [channelSummaries, setChannelSummaries] = useState<Record<string, ChannelSummary>>({})
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({})
  const [roundtableDiscussing, setRoundtableDiscussing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const messagesRef = useRef<ChannelMessage[]>([])
  const nextCursorRef = useRef<string | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const activeChannelIdRef = useRef(selectedId)
  const loadMessagesRequestRef = useRef(0)
  const loadOlderInFlightRef = useRef(false)
  const loadOlderSequenceRef = useRef(0)
  const suppressAutoLoadOlderUntilRef = useRef(0)
  const revealPrependedHistoryRef = useRef(false)
  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0]
  const isWorld = selected?.id === WORLD_CHANNEL_ID
  const isRoundtable = selected?.id === SOULWING_ROUNDTABLE_CHANNEL_ID
  const embeddedHeaderButtonClass = hideSidebar
    ? "h-8 rounded-full border-blue-100 bg-white px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
    : "h-8"
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends])
  const inputDraftKey = selectedId ? userStorageKey(userId, "chat-input", `channel:${selectedId}`) : ""
  const channelSeenKey = getChannelSeenStorageKey(userId)
  const selectedChannelKey = getSelectedChannelStorageKey(userId)
  const activeReplyTo = useMemo(
    () => (replyTo && messages.some((message) => message.id === replyTo.id) ? replyTo : null),
    [messages, replyTo]
  )
  const forceScrollToBottomRef = useRef(false)

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

  useEffect(() => {
    activeChannelIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  const persistSeenCounts = useCallback((value: Record<string, number>) => {
    writeUserStorage({ kind: "local", key: channelSeenKey, userId, value })
    emitChannelSeenCountsChanged(value)
  }, [channelSeenKey, userId])

  const selectChannel = useCallback((channelId: string) => {
    setSelectedId(channelId)
    writeUserStorage({
      kind: "local",
      key: selectedChannelKey,
      userId,
      value: { channelId },
    })
  }, [selectedChannelKey, userId])

  const markChannelSeen = useCallback((channelId: string) => {
    if (!channelId || channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) return
    const totalCount = channelSummaries[channelId]?.totalCount
    if (typeof totalCount !== "number") return
    setSeenCounts((current) => {
      if (current[channelId] === totalCount) return current
      const next = { ...current, [channelId]: totalCount }
      persistSeenCounts(next)
      return next
    })
  }, [channelSummaries, persistSeenCounts])

  const loadChannelSummaries = useCallback(async () => {
    const res = await fetch("/api/channels/summary", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    const items = Array.isArray(data.items) ? data.items as ChannelSummary[] : []
    const byId = Object.fromEntries(items.map((item) => [item.channelId, item]))
    setChannelSummaries(byId)
    setSeenCounts((current) => {
      if (Object.keys(current).length > 0) return current
      const stored = readUserStorage<Record<string, number>>({
        kind: "local",
        key: channelSeenKey,
        userId,
        ttlMs: CHANNEL_SUMMARY_TTL_MS,
      })
      if (stored) return stored
      const initial = Object.fromEntries(items.map((item) => [item.channelId, item.totalCount]))
      persistSeenCounts(initial)
      return initial
    })
  }, [channelSeenKey, persistSeenCounts, userId])

  const loadRoundtablePulse = useCallback(async () => {
    const res = await fetch("/api/soulwing-roundtable", { cache: "no-store" }).catch(() => null)
    if (!res?.ok) return
    const data = await res.json().catch(() => ({}))
    setRoundtableDiscussing(Boolean(data.isDiscussing))
  }, [])

  const loadChannels = useCallback(async () => {
    const [channelRes, friendRes] = await Promise.all([
      fetch("/api/channels", { cache: "no-store" }),
      fetch("/api/friends", { cache: "no-store" }),
    ])
    const channelData = await channelRes.json().catch(() => ({}))
    const friendData = await friendRes.json().catch(() => [])
    if (!channelRes.ok) throw new Error(channelData.error ?? dict.channels.loadFailed)
    setCurrentUserId(channelData.currentUserId ?? "")
    const loadedChannels = Array.isArray(channelData.items) ? channelData.items as Channel[] : []
    const roundtableChannel: Channel = {
      id: SOULWING_ROUNDTABLE_CHANNEL_ID,
      type: "soulwing-roundtable",
      name: "蝶灵圆桌",
      announcement: "特殊群聊 · 蝶灵发言",
      ownerId: null,
      ownerName: null,
      currentUserRole: null,
      members: [],
    }
    const worldIndex = loadedChannels.findIndex((channel) => channel.id === WORLD_CHANNEL_ID)
    const nextChannels = worldIndex >= 0
      ? [
          ...loadedChannels.slice(0, worldIndex + 1),
          roundtableChannel,
          ...loadedChannels.slice(worldIndex + 1).filter((channel) => channel.id !== SOULWING_ROUNDTABLE_CHANNEL_ID),
        ]
      : [roundtableChannel, ...loadedChannels]
    setChannels(nextChannels)
    const stored = readUserStorage<{ channelId: string }>({
      kind: "local",
      key: selectedChannelKey,
      userId,
      ttlMs: CHANNEL_SUMMARY_TTL_MS,
    })
    const storedChannelId = stored?.channelId
    if (initialChannelId && nextChannels.some((channel) => channel.id === initialChannelId)) {
      setSelectedId(initialChannelId)
    } else if (storedChannelId && nextChannels.some((channel) => channel.id === storedChannelId)) {
      setSelectedId(storedChannelId)
    }
    setFriends(Array.isArray(friendData) ? friendData : [])
  }, [dict.channels.loadFailed, initialChannelId, selectedChannelKey, userId])

  const loadMessages = useCallback(async (channelId: string, options?: { cursor?: string | null; appendOlder?: boolean }) => {
    const requestSequence = ++loadMessagesRequestRef.current
    const isCurrentRequest = () => activeChannelIdRef.current === channelId && loadMessagesRequestRef.current === requestSequence
    if (channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) {
      if (isCurrentRequest()) {
        setMessages([])
        setNextCursor(null)
      }
      return { prependedIds: [] }
    }
    const appendOlder = options?.appendOlder ?? false
    if (appendOlder) setLoadingOlder(true)
    else setLoading(true)
    try {
      let items: ChannelMessage[] = []
      let incomingNextCursor: string | null = null

      if (appendOlder) {
        let cursorToUse = options?.cursor ?? null
        let attempts = 0
        while (cursorToUse && attempts < 8) {
          const params = new URLSearchParams({ limit: String(OLDER_HISTORY_BATCH_SIZE), _t: String(Date.now()) })
          params.set("cursor", cursorToUse)
          const res = await fetch(`/api/channels/${channelId}/messages?${params.toString()}`, { cache: "no-store" })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error ?? dict.channels.loadFailed)
          const fetchedItems = Array.isArray(data.items) ? data.items as ChannelMessage[] : []
          const fetchedNextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null
          const existingIds = new Set(messagesRef.current.map((item) => item.id))
          const nonDuplicateItems = fetchedItems.filter((item) => !existingIds.has(item.id))
          items = fetchedItems
          incomingNextCursor = fetchedNextCursor
          if (nonDuplicateItems.length > 0 || !fetchedNextCursor) break
          cursorToUse = fetchedNextCursor
          attempts += 1
        }
      } else {
        const params = new URLSearchParams({ limit: String(INITIAL_HISTORY_BATCH_SIZE), _t: String(Date.now()) })
        if (options?.cursor) params.set("cursor", options.cursor)
        const res = await fetch(`/api/channels/${channelId}/messages?${params.toString()}`, { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? dict.channels.loadFailed)
        items = Array.isArray(data.items) ? data.items as ChannelMessage[] : []
        incomingNextCursor = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null
      }
      if (!isCurrentRequest()) return { prependedIds: [] }
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
      }
      forceScrollToBottomRef.current = true
      const currentServerMessages = messagesRef.current.filter((item) => !item.localStatus)
      const currentOldest = currentServerMessages[0]
      const incomingOldest = items[0]
      const shouldPreserveExpandedHistory =
        currentServerMessages.length > items.length ||
        isEarlierChannelMessage(currentOldest, incomingOldest)
      setNextCursor(shouldPreserveExpandedHistory ? nextCursorRef.current : incomingNextCursor)
      const restoredDrafts = await listChatOutboxItems(userId, "channel", channelId)
      const draftMessages = restoredDrafts.map((item) => outboxToChannelMessage(item, currentUser))
      if (!isCurrentRequest()) return { prependedIds: [] }
      setMessages((current) => mergeChannelMessages(current.filter((item) => item.localStatus !== "failed"), [...items, ...draftMessages]))
    } catch (error) {
      if (activeChannelIdRef.current === channelId) {
        toast.error(error instanceof Error ? error.message : dict.channels.loadFailed)
      }
    } finally {
      if (isCurrentRequest()) {
        if (appendOlder) setLoadingOlder(false)
        else setLoading(false)
      }
    }
  }, [currentUser, userId, dict.channels.loadFailed])

  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || loading || loadingOlder) return
    const oldestLoadedServerMessage = messagesRef.current.find((message) => !message.localStatus) ?? null
    const cursor = makeChannelMessageCursor(oldestLoadedServerMessage) ?? nextCursorRef.current
    if (!cursor) return
    return await loadMessages(selectedId, { cursor, appendOlder: true })
  }, [loadMessages, loading, loadingOlder, selectedId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadChannels().catch((error) => toast.error(error instanceof Error ? error.message : dict.channels.loadFailed))
      void loadChannelSummaries()
      void loadRoundtablePulse()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadChannelSummaries, loadChannels, loadRoundtablePulse, dict.channels.loadFailed])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadChannelSummaries()
      void loadRoundtablePulse()
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [loadChannelSummaries, loadRoundtablePulse])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      markChannelSeen(selectedId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [markChannelSeen, selectedId])

  useEffect(() => {
    const shouldPollMembers = channels.some((channel) => channel.type === "group" && channel.members.length < 9)
    if (!shouldPollMembers) return
    const timer = window.setInterval(() => {
      loadChannels().catch(() => null)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [channels, loadChannels])

  useEffect(() => {
    if (!selectedId) return
    forceScrollToBottomRef.current = true
    if (selectedId === SOULWING_ROUNDTABLE_CHANNEL_ID) {
      const timer = window.setTimeout(() => {
        setMessages([])
        setNextCursor(null)
        setText("")
        setFiles([])
        setSticker(null)
        setReplyTo(null)
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const savedText = inputDraftKey
      ? readUserStorage<{ text: string }>({ kind: "session", key: inputDraftKey, userId, ttlMs: INPUT_DRAFT_TTL_MS })?.text ?? ""
      : ""
    const timer = window.setTimeout(() => {
      setMessages([])
      setNextCursor(null)
      setText(savedText)
      void loadMessages(selectedId)
    }, 0)
    const source = new EventSource(`/api/channels/${selectedId}/events`)
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChannelMessage
      if (message.channelId !== selectedId) return
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current
        const withoutLocal = current.filter((item) => !(item.localStatus === "sending" && item.senderId === message.senderId && item.channelId === message.channelId))
        return [...withoutLocal, message]
      })
      if (selectedId === WORLD_CHANNEL_ID) onWorldAnnouncement()
    })
    source.onerror = () => undefined
    return () => {
      window.clearTimeout(timer)
      source.close()
    }
  }, [inputDraftKey, loadMessages, onWorldAnnouncement, selectedId, userId])

  useEffect(() => {
    if (!inputDraftKey) return
    if (!text) {
      removeUserStorage("session", inputDraftKey)
      return
    }
    writeUserStorage({ kind: "session", key: inputDraftKey, userId, value: { text } })
  }, [inputDraftKey, text, userId])

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type !== "channel:message") return
      const message = payload.data as ChannelMessage | undefined
      if (!message?.channelId || message.channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) return
      const nextTotal = (channelSummaries[message.channelId]?.totalCount ?? seenCounts[message.channelId] ?? 0) + 1
      setChannelSummaries((current) => {
        return {
          ...current,
          [message.channelId]: {
            channelId: message.channelId,
            totalCount: nextTotal,
            latest: { id: message.id, text: message.text, createdAt: message.createdAt },
          },
        }
      })
      if (message.channelId === selectedId) {
        setSeenCounts((current) => {
          const next = { ...current, [message.channelId]: nextTotal }
          persistSeenCounts(next)
          return next
        })
      }
    }
    window.addEventListener("app:realtime", handler)
    return () => window.removeEventListener("app:realtime", handler)
  }, [channelSummaries, persistSeenCounts, seenCounts, selectedId])

  useLayoutEffect(() => {
    lastMessageIdRef.current = null
    shouldStickToBottomRef.current = true
    forceScrollToBottomRef.current = Boolean(selectedId)
    scrollToLatestMessage()
  }, [scrollToLatestMessage, selectedId])

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
    const latestMessageIsMine = latestMessage ? latestMessage.senderId === (currentUserId || userId) : false
    const shouldForce = forceScrollToBottomRef.current || lastMessageIdRef.current === null
    if (currentLastMessageId && lastMessageChanged && (shouldForce || shouldStickToBottomRef.current || latestMessageIsMine)) {
      forceScrollToBottomRef.current = false
      scrollToLatestMessage()
    } else if (forceScrollToBottomRef.current) {
      forceScrollToBottomRef.current = false
      scrollToLatestMessage()
    }
    lastMessageIdRef.current = currentLastMessageId
  }, [currentUserId, messages, scrollToLatestMessage, userId])

  useEffect(() => {
    const container = scrollContainerRef.current
    const content = container?.firstElementChild
    if (!container || !content || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (forceScrollToBottomRef.current || shouldStickToBottomRef.current) scrollToLatestMessage()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [loading, messages.length, scrollToLatestMessage])

  async function sendMessage(stickerOverride?: StickerPick | null) {
    const activeSticker = stickerOverride ?? sticker
    const draft = text.trim()
    const draftFiles = [...files]
    if (!selected || selected.id === SOULWING_ROUNDTABLE_CHANNEL_ID || (!draft && draftFiles.length === 0 && !activeSticker) || sending) return

    const shouldPublish = isWorld && publishToAnnouncement
    removeUserStorage("session", inputDraftKey)
    setText("")
    setFiles([])
    setSticker(null)
    setReplyTo(null)
    setPublishToAnnouncement(false)
    setSending(true)

    const batches = [
      ...(draft ? [{ text: draft, files: [] as File[], sticker: null as StickerPick | null, publish: shouldPublish }] : []),
      ...draftFiles.map((file) => ({ text: "", files: [file], sticker: null as StickerPick | null, publish: false })),
      ...(activeSticker ? [{ text: "", files: [] as File[], sticker: activeSticker, publish: false }] : []),
    ]
    const localEntries = batches.map((batch, index) => {
      const clientMutationId = crypto.randomUUID()
      const localId = `local-${clientMutationId}`
      const localMessage: ChannelMessage = {
        id: localId,
        channelId: selected.id,
        senderId: currentUser.id,
        sender: currentUser,
        text: batch.text,
        stickerId: batch.sticker?.type === "asset" ? batch.sticker.id : null,
        stickerEmoji: batch.sticker?.type === "emoji" ? batch.sticker.emoji : null,
        sticker: batch.sticker?.type === "asset" ? { id: batch.sticker.id, url: batch.sticker.url, name: batch.sticker.name } : null,
        createdAt: new Date().toISOString(),
        attachments: batch.files.map((file, fileIndex) => ({
          id: `${localId}-${fileIndex}`,
          originalName: file.name || "file",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          downloadUrl: URL.createObjectURL(file),
        })),
        replyTo: index === 0 && activeReplyTo
          ? {
              id: activeReplyTo.id,
              sender: activeReplyTo.sender,
              text: activeReplyTo.text,
              stickerEmoji: activeReplyTo.stickerEmoji ?? null,
              sticker: activeReplyTo.sticker ?? null,
              attachments: activeReplyTo.attachments,
            }
          : null,
        localStatus: "sending",
      }
      return { batch, clientMutationId, localId, localMessage }
    })
    setMessages((current) => [...current, ...localEntries.map((entry) => entry.localMessage)])

    let firstReplyId = activeReplyTo?.id ?? null
    for (let index = 0; index < localEntries.length; index += 1) {
      const { batch, clientMutationId, localId } = localEntries[index]
      try {
        const created = await uploadChannelMessage({
          channelId: selected.id,
          text: batch.text,
          files: batch.files,
          sticker: batch.sticker,
          publishToAnnouncement: batch.publish,
          replyToId: index === 0 ? firstReplyId : null,
        })
        setMessages((current) => current.map((item) => item.id === localId ? created : item))
        await deleteChatOutboxItem(localId)
        if (batch.publish && batch.text) onWorldAnnouncement()
      } catch (error) {
        const message = error instanceof Error ? error.message : dict.channels.loadFailed
        await saveChatOutboxItem({
          id: localId,
          clientMutationId,
          userId,
          conversationType: "channel",
          conversationId: selected.id,
          text: batch.text,
          sticker: batch.sticker ?? null,
          files: batch.files,
          createdAt: Date.now(),
          lastError: message,
        }).catch((saveError) => {
          toast.error(saveError instanceof Error ? saveError.message : dict.channels.loadFailed)
        })
        setMessages((current) => current.map((item) => item.id === localId ? { ...item, localStatus: "failed" } : item))
        toast.error(message)
      }

      firstReplyId = null
    }

    setSending(false)
  }

  async function retryFailedMessage(messageId: string) {
    const items = await listChatOutboxItems(userId, "channel", selectedId)
    const item = items.find((entry) => entry.id === messageId)
    if (!item || sending) return
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, localStatus: "sending" } : message))
    setSending(true)
    try {
      const created = await uploadChannelMessage({
        channelId: item.conversationId,
        text: item.text,
        files: item.files,
        sticker: item.sticker ?? null,
        publishToAnnouncement: false,
      })
      await deleteChatOutboxItem(messageId)
      setMessages((current) => current.map((message) => message.id === messageId ? created : message))
    } catch (error) {
      const message = error instanceof Error ? error.message : dict.channels.send
      await saveChatOutboxItem({ ...item, lastError: message })
      setMessages((current) => current.map((entry) => entry.id === messageId ? { ...entry, localStatus: "failed" } : entry))
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  async function discardFailedMessage(messageId: string) {
    await deleteChatOutboxItem(messageId)
    setMessages((current) => current.filter((message) => message.id !== messageId))
  }

  const handleLoadOlderMessages = useCallback(async () => {
    if (loadingOlder || loadOlderInFlightRef.current) return
    loadOlderInFlightRef.current = true
    const requestSequence = ++loadOlderSequenceRef.current
    try {
      const result = await loadOlderMessages()
      if (loadOlderSequenceRef.current !== requestSequence) return
      const prependedIds = result && "prependedIds" in result ? result.prependedIds ?? [] : []
      if (prependedIds.length > 0) {
        revealPrependedHistoryRef.current = true
      }
      suppressAutoLoadOlderUntilRef.current = Date.now() + 500
    } finally {
      loadOlderInFlightRef.current = false
    }
  }, [loadingOlder, loadOlderMessages])

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
    setFiles((current) => [...current, ...pastedFiles])
  }, [])

  return (
    <div className={`relative flex min-h-0 w-full max-w-full flex-1 overflow-hidden ${hideSidebar ? "" : "md:grid md:grid-cols-[260px_minmax(0,1fr)]"} ${className}`}>
      {!hideSidebar && channelMenuOpen && (
        <button
          type="button"
          aria-label={dict.common.close}
          onClick={() => setChannelMenuOpen(false)}
          className="absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px] transition-opacity md:hidden"
        />
      )}
      {!hideSidebar && (
      <aside className={`absolute inset-y-0 left-0 z-20 isolate flex min-h-0 w-[min(82vw,280px)] flex-col border-r border-[--color-border] bg-[--color-bg-primary]/95 shadow-xl backdrop-blur-md transition-transform duration-200 md:static md:z-auto md:w-auto md:translate-x-0 md:bg-[--color-bg-primary] md:shadow-none md:backdrop-blur-none ${channelMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[--color-border] bg-[--color-bg-primary]/95 p-3 backdrop-blur-md md:bg-transparent md:backdrop-blur-none">
          <p className="text-sm font-semibold">{dict.channels.channels}</p>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {channels.map((channel) => {
            const summary = channelSummaries[channel.id]
            const unread = channel.id === SOULWING_ROUNDTABLE_CHANNEL_ID
              ? 0
              : Math.max((summary?.totalCount ?? 0) - (seenCounts[channel.id] ?? summary?.totalCount ?? 0), 0)
            const showRoundtablePulse = channel.id === SOULWING_ROUNDTABLE_CHANNEL_ID && roundtableDiscussing
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  selectChannel(channel.id)
                  markChannelSeen(channel.id)
                  setChannelMenuOpen(false)
                }}
                className={`flex w-full min-w-0 items-center gap-3 border-b border-[--color-border] px-3 py-3 text-left hover:bg-[--color-bg-hover] ${selectedId === channel.id ? "bg-[--color-bg-hover]" : "bg-[--color-bg-primary]/90"}`}
              >
                <span className="relative shrink-0">
                  {channel.type === "world" ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] border border-[--color-border] bg-[--color-bg-hover] text-[--color-text-secondary]">
                      <MessageCircle size={20} />
                    </span>
                  ) : channel.type === "soulwing-roundtable" ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] border border-violet-200 bg-violet-50 text-violet-600">
                      <Sparkles size={20} />
                    </span>
                  ) : (
                    <GroupAvatar members={channel.members} name={channel.name} />
                  )}
                  {unread > 0 ? (
                    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[--color-danger] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                  {showRoundtablePulse ? (
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-violet-500 ring-2 ring-white">
                      <span className="absolute inset-0 animate-ping rounded-full bg-violet-500" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{channel.name}</span>
                  <span className="block truncate text-xs text-[--color-text-muted]">
                    {channel.type === "world"
                      ? dict.channels.allUsers
                      : channel.type === "soulwing-roundtable"
                        ? (roundtableDiscussing ? "正在讨论 · 蝶灵发言" : "特殊群聊 · 蝶灵发言")
                        : dict.channels.membersCount(channel.members.length)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
      )}

      <main className="flex min-h-0 min-w-0 w-full flex-col">
        <div className={`flex items-center justify-between gap-2 px-3 py-3 sm:px-4 ${hideSidebar ? "border-b border-slate-100 bg-white/95" : "border-b border-[--color-border]"}`}>
          {headerPrefix}
          {!hideSidebar && (
            <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2 md:hidden" onClick={() => setChannelMenuOpen(true)}>
              <Menu size={15} />
              <span>{dict.channels.channels}</span>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected?.name ?? dict.channels.channels}</p>
            <p className="truncate text-xs text-[--color-text-muted]">
              {isRoundtable ? "不能直接发普通群消息，只能通过蝶灵参与圆桌" : isWorld ? dict.channels.channelMessagesHint : selected?.members.map((member) => member.displayName || member.email).join(", ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {isWorld && (
              <Button type="button" size="sm" variant="outline" className={embeddedHeaderButtonClass} onClick={() => {
                setWorldMembersOpen(true)
                if (worldMembers.length === 0) {
                  setWorldMembersLoading(true)
                  fetch(`/api/channels/${WORLD_CHANNEL_ID}/members`)
                    .then((r) => r.json())
                    .then((data) => setWorldMembers(Array.isArray(data.members) ? data.members : []))
                    .catch(() => {})
                    .finally(() => setWorldMembersLoading(false))
                }
              }}>
                <UserPlus size={14} />
                <span className="hidden sm:inline">查看成员</span>
              </Button>
            )}
            {!isWorld && !isRoundtable && (
              <Button type="button" size="sm" variant="outline" className={embeddedHeaderButtonClass} onClick={() => setInviteOpen(true)}>
                <UserPlus size={14} />
                <span className="hidden sm:inline">{dict.channels.invite}</span>
              </Button>
            )}
            {!isWorld && !isRoundtable && selected ? (
              <Button asChild type="button" size="sm" variant="outline" className={embeddedHeaderButtonClass}>
                <Link href={`/channels/${selected.id}`}>{dict.channels.manage}</Link>
              </Button>
            ) : null}
            {isRoundtable ? (
              <Button asChild type="button" size="sm" variant="outline" className={embeddedHeaderButtonClass}>
                <Link href="/channels/soulwing-roundtable">
                  <Sparkles size={14} />
                  <span className="hidden sm:inline">圆桌管理</span>
                </Link>
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" className={embeddedHeaderButtonClass} onClick={() => selected && (isRoundtable ? window.dispatchEvent(new CustomEvent("soulwing-roundtable:refresh")) : loadMessages(selected.id))}>
              <RefreshCcw size={14} />
              <span className="hidden sm:inline">{dict.common.refresh}</span>
            </Button>
          </div>
        </div>

        {isRoundtable ? (
          <div className="min-h-0 flex-1 overflow-hidden bg-[--color-bg-primary]">
            <SoulWingRoundtableClient currentUser={currentUser} locale={locale} embedded initialDiscussionId={initialRoundtableDiscussionId} />
          </div>
        ) : (
        <>
        <div ref={scrollContainerRef} className="mobile-chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[--color-text-muted]">{dict.common.loading}</p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[--color-text-muted]">{dict.channels.empty}</p>
          ) : (
            <div className="space-y-3">
              {(nextCursor || loadingOlder) && (
                <div className="flex justify-center pb-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void handleLoadOlderMessages()} disabled={loadingOlder} className="h-8 text-xs text-[--color-text-muted]">
                    {loadingOlder ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        {dict.common.loading}
                      </>
                    ) : (
                      dict.channels.loadEarlier
                    )}
                  </Button>
                </div>
              )}
                  {messages.map((message, index) => (
                <div key={message.id} data-message-id={message.id}>
                  {shouldShowTime(messages[index - 1], message) && (
                    <p className="my-4 text-center font-mono text-xs text-[--color-text-muted]">{formatChatTime(message.createdAt)}</p>
                  )}
                  <ChannelMessageBubble
                    message={message}
                    mine={message.senderId === (currentUserId || userId)}
                    locale={locale}
                    userId={userId}
                    onUserClick={setProfileUser}
                    onImagePreview={setPreviewImage}
                    onRetry={retryFailedMessage}
                    onDiscard={discardFailedMessage}
                    onReply={setReplyTo}
                  />
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form
          className="wechat-composer p-3 pb-[5px]"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])
              event.currentTarget.value = ""
            }}
          />
          <div className="wechat-composer-panel flex flex-col">
            <ChatComposerAttachments
              files={files}
              sticker={sticker}
              fileLabel={locale === "en-US" ? "File" : "文件"}
              onRemoveFile={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
              onRemoveSticker={() => setSticker(null)}
            />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => handleEnterToSubmit(event, () => void sendMessage(), { disabled: sending || (!text.trim() && files.length === 0 && !sticker) })}
              onPaste={handleComposerPaste}
              rows={3}
              placeholder={dict.channels.typeMessage}
              className="wechat-composer-input max-h-32 flex-1 resize-none px-3 py-3 text-sm text-[--color-text-primary]"
            />
            {activeReplyTo ? (
              <ComposerReplyPreview
                sender={activeReplyTo.sender.displayName || activeReplyTo.sender.email}
                summary={getChannelReplySummary(activeReplyTo)}
                onClear={() => setReplyTo(null)}
              />
            ) : null}
            <div className="flex items-center gap-1 px-3 pb-3">
              <StickerPicker
                userId={userId}
                onPick={(pick) => {
                  if (pick.type === "emoji") {
                    setText((current) => `${current}${pick.emoji}`)
                  } else {
                    void sendMessage(pick)
                  }
                }}
              />
              <Button type="button" size="sm" variant="ghost" className="h-9 w-9 shrink-0 px-0 text-[--color-text-secondary] hover:bg-[#ededed]" onClick={() => inputRef.current?.click()}>
                <Paperclip size={18} />
              </Button>
              <SoulWingReplyButton
                chatType="group"
                conversationId={selectedId}
                onInsertDraft={(reply) => setText(reply)}
              />
              {isWorld && (
                <button
                  type="button"
                  onClick={() => setPublishToAnnouncement((value) => !value)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-sm] transition-colors ${publishToAnnouncement ? "bg-[--color-warning-bg] text-[--color-warning]" : "text-[--color-text-muted] hover:bg-[#ededed]"}`}
                  title={dict.channels.publishToFeed}
                >
                  <Megaphone size={16} fill={publishToAnnouncement ? "currentColor" : "none"} />
                </button>
              )}
              <div className="flex-1" />
              <Button
                type="submit"
                size="sm"
                disabled={sending || (!text.trim() && files.length === 0 && !sticker)}
                onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, () => void sendMessage())}
                className="h-9 shrink-0 rounded-md bg-[#f0f0f0] px-5 text-sm font-normal text-[#9b9b9b] shadow-none hover:bg-[#e8e8e8] enabled:bg-[#3b82f6] enabled:text-white"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} className="sm:hidden" />}
                <span>{sending ? dict.channels.sending : dict.channels.send}</span>
              </Button>
            </div>
          </div>
        </form>
        </>
        )}
      </main>

      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        friends={friends}
        onCreated={(channel) => {
          setChannels((current) => [current.find((item) => item.id === WORLD_CHANNEL_ID)!, channel, ...current.filter((item) => item.id !== WORLD_CHANNEL_ID)])
          selectChannel(channel.id)
        }}
      />
      {selected && !isRoundtable && (
        <ChannelInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          channel={selected}
          friends={friends}
          onMembers={(members) => {
            setChannels((current) => current.map((channel) => channel.id === selected.id ? { ...channel, members } : channel))
          }}
        />
      )}
      <Sheet open={worldMembersOpen} onOpenChange={setWorldMembersOpen}>
        <SheetContent side="right" className="w-72 sm:w-80">
          <SheetHeader>
            <SheetTitle>世界频道成员</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 overflow-y-auto">
            {worldMembersLoading ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">加载中…</p>
            ) : worldMembers.length === 0 ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">暂无成员</p>
            ) : (
              worldMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[--color-bg-hover] active:bg-[--color-bg-hover]"
                  onClick={() => { setProfileUser(member); setWorldMembersOpen(false) }}
                >
                  <UserAvatar size="sm" name={member.displayName} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.displayName || member.email}</p>
                    {member.displayName && <p className="truncate text-xs text-[--color-text-muted]">{member.email}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      <UserProfileDialog
        user={profileUser}
        currentUserId={currentUserId || userId}
        isFriend={profileUser ? friendIds.has(profileUser.id) : false}
        onOpenChange={(open) => !open && setProfileUser(null)}
      />
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

function ChannelMessageBubble({
  message,
  mine,
  locale,
  userId,
  onUserClick,
  onImagePreview,
  onRetry,
  onDiscard,
  onReply,
}: {
  message: ChannelMessage
  mine: boolean
  locale: AppLocale
  userId: string
  onUserClick: (user: Friend) => void
  onImagePreview: (attachment: ChannelAttachment) => void
  onRetry: (messageId: string) => void
  onDiscard: (messageId: string) => void
  onReply: (message: ChannelMessage) => void
}) {
  const dict = getDict()
  const assetStickerOnly = !message.text && !message.stickerEmoji && Boolean(message.sticker) && message.attachments.length === 0
  const imageOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => attachment.mimeType.startsWith("image/"))
  const fileOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => !attachment.mimeType.startsWith("image/"))
  const attachmentOnly = imageOnly || fileOnly
  const hasLeadingContent = Boolean(message.text || message.stickerEmoji || message.sticker)
  const primaryImage = getPrimaryChannelImageAttachment(message)
  const actionLabels = locale === "en-US"
    ? { reply: "Quote", copy: "Copy", copied: "Copied", copyFailed: "Copy failed", you: "You" }
    : { reply: "引用", copy: "复制", copied: "已复制", copyFailed: "复制失败", you: "我" }
  const replySummary = getChannelReplySummary(message.replyTo)
  const isEN = dict.common.copy === "Copy"
  const addStickerLabel = dict.stickers.addToCustom
  const stickerSavedLabel = dict.stickers.savedToCustom
  const downloadImageLabel = isEN ? "Download Image" : "下载图片"
  const copyImageLabel = isEN ? "Copy Image" : "复制图片"
  const copyImageSuccessLabel = isEN ? "Image copied. You can paste it into the composer." : "图片已复制，可直接粘贴到输入框"
  const copyImageFailedLabel = isEN ? "Image copy failed" : "复制图片失败"
  const sendFailedLabel = isEN ? "Send failed" : "发送失败"
  const sendingLabel = dict.channels.sending
  const retryLabel = dict.common.retry
  const discardLabel = locale === "en-US" ? "Discard" : "放弃"
  const actionPreview = <ChannelMessageActionPreview message={message} senderName={message.sender.displayName || message.sender.email || actionLabels.you} />
  const actionItems: MessageActionItem[] = [
    {
      id: "reply",
      label: actionLabels.reply,
      onSelect: () => onReply(message),
    },
    {
      id: "copy",
      label: actionLabels.copy,
      onSelect: async () => {
        const copyText = getChannelMessageCopyText(message)
        if (!copyText) return
        try {
          await navigator.clipboard.writeText(copyText)
          toast.success(actionLabels.copied)
        } catch {
          toast.error(actionLabels.copyFailed)
        }
      },
    },
  ]
  if (message.sticker?.id) {
    actionItems.splice(1, 0, {
      id: "save-sticker",
      label: addStickerLabel,
      onSelect: async () => {
        try {
          await saveStickerToCustomLibrary(message.sticker!.id, userId)
          toast.success(stickerSavedLabel)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : actionLabels.copyFailed)
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
  return (
    <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <button type="button" onClick={() => onUserClick(message.sender)} className="mt-5 shrink-0">
          <UserAvatar size="sm" name={message.sender.displayName} email={message.sender.email} avatarText={message.sender.avatarText} avatarUrl={message.sender.avatarUrl} />
        </button>
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <p className="mb-1 max-w-full truncate text-xs text-[--color-text-muted]">{message.sender.displayName || message.sender.email}</p>
        <MessageActionSurface className={(assetStickerOnly || attachmentOnly) ? "" : `wechat-bubble px-3 py-2 text-[--color-text-primary] ${mine ? "wechat-bubble-right" : "wechat-bubble-left"}`} items={actionItems} preview={actionPreview}>
          {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
          {message.stickerEmoji && <p className="text-5xl leading-none">{message.stickerEmoji}</p>}
          {message.sticker && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.sticker.url} alt={message.sticker.name || message.sticker.originalName || "sticker"} className={assetStickerOnly ? "max-h-36 max-w-36 object-contain" : "max-h-32 max-w-32 object-contain"} />
          )}
          {message.attachments.length > 0 && (
            <div className={hasLeadingContent ? "mt-2 space-y-2" : "space-y-2"}>
              {message.attachments.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} mine={mine} onPreview={onImagePreview} />)}
            </div>
          )}
          {message.localStatus && (
            <div className="mt-1 text-right font-mono text-[10px] text-[--color-text-muted]">
              <span>{message.localStatus === "sending" ? sendingLabel : sendFailedLabel}</span>
              {message.localStatus === "failed" && (
                <div className="mt-1 flex justify-end gap-2">
                  <button type="button" onClick={() => onRetry(message.id)} className="text-[--color-link] hover:underline">{retryLabel}</button>
                  <button type="button" onClick={() => onDiscard(message.id)} className="text-[--color-danger] hover:underline">{discardLabel}</button>
                </div>
              )}
            </div>
          )}
        </MessageActionSurface>
        {message.replyTo && replySummary ? (
          <MessageReplyReference
            sender={message.replyTo.sender.displayName || message.replyTo.sender.email || actionLabels.you}
            summary={replySummary}
            align={mine ? "right" : "left"}
          />
        ) : null}
      </div>
      {mine && (
        <button type="button" onClick={() => onUserClick(message.sender)} className="mt-5 shrink-0">
          <UserAvatar size="sm" name={message.sender.displayName} email={message.sender.email} avatarText={message.sender.avatarText} avatarUrl={message.sender.avatarUrl} />
        </button>
      )}
    </div>
  )
}

function AttachmentView({ attachment, mine, onPreview }: { attachment: ChannelAttachment; mine: boolean; onPreview: (attachment: ChannelAttachment) => void }) {
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

function ChannelMessageActionPreview({ message, senderName }: { message: ChannelMessage; senderName: string }) {
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

function UserProfileDialog({ user, currentUserId, isFriend, onOpenChange }: { user: Friend | null; currentUserId: string; isFriend: boolean; onOpenChange: (open: boolean) => void }) {
  const dict = getDict()
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const isSelf = user?.id === currentUserId
  const isEN = dict.common.copy === "Copy"
  const selfLabel = isEN ? "This is you." : "这是你自己。"
  const addFriendLabel = isEN ? "Add friend" : "添加好友"
  const sendingLabel = dict.channels.sending
  const friendRequestNoteLabel = isEN ? "Friend request note" : "好友申请备注"
  const friendRequestSentLabel = isEN ? "Friend request sent" : "好友申请已发送"
  const friendRequestSendFailedLabel = isEN ? "Failed to send friend request" : "好友申请发送失败"

  async function sendFriendRequest() {
    if (!user || !note.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? friendRequestSendFailedLabel)
      toast.success(data.message ?? friendRequestSentLabel)
      setNote("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : friendRequestSendFailedLabel)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <UserAvatar size="sm" name={user.displayName} email={user.email} avatarText={user.avatarText} avatarUrl={user.avatarUrl} />
                <span>{user.displayName || user.email}</span>
              </DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>
            {isSelf ? (
              <p className="text-sm text-[--color-text-muted]">{selfLabel}</p>
            ) : isFriend ? (
              <DialogFooter>
                <Button asChild variant="outline">
                  <Link href={`/u/${user.id}`}>{dict.nav.home}</Link>
                </Button>
                <Button asChild>
                  <Link href={`/friends?type=direct&id=${encodeURIComponent(user.id)}`}>{dict.nav.friends}</Link>
                </Button>
              </DialogFooter>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={120}
                  rows={3}
                  placeholder={friendRequestNoteLabel}
                  className="w-full resize-none rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm outline-none focus:border-[--color-accent]"
                />
                <DialogFooter>
                  <Button type="button" onClick={sendFriendRequest} disabled={sending || !note.trim()}>
                    {sending ? sendingLabel : addFriendLabel}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ChannelCreateDialog({ open, onOpenChange, friends, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; friends: Friend[]; onCreated: (channel: Channel) => void }) {
  const dict = getDict()
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected])
  const createGroupFailedLabel = dict.channels.loadFailed

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds: selectedIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? createGroupFailedLabel)
      onCreated(data)
      setName("")
      setSelected({})
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : createGroupFailedLabel)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={createGroup}>
          <DialogHeader>
            <DialogTitle>{dict.channels.createGroup}</DialogTitle>
            <DialogDescription>{dict.channels.invite}</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={dict.channels.groupName} className="w-full rounded-[--radius-sm] border border-[--color-border] px-3 py-2 text-sm outline-none focus:border-[--color-accent]" />
            <FriendChecklist friends={friends} selected={selected} onSelected={setSelected} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.common.cancel}</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? dict.common.saving : dict.common.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChannelInviteDialog({ open, onOpenChange, channel, friends, onMembers }: { open: boolean; onOpenChange: (open: boolean) => void; channel: Channel; friends: Friend[]; onMembers: (members: Friend[]) => void }) {
  const dict = getDict()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const memberIds = new Set(channel.members.map((member) => member.id))
  const available = friends.filter((friend) => !memberIds.has(friend.id))
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected])
  const inviteFailedLabel = dict.channels.loadFailed

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedIds.length === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/channels/${channel.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: selectedIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? inviteFailedLabel)
      onMembers(Array.isArray(data.members) ? data.members : channel.members)
      setSelected({})
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : inviteFailedLabel)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={invite}>
          <DialogHeader>
            <DialogTitle>{dict.channels.invite}</DialogTitle>
            <DialogDescription>{dict.channels.invite}</DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <FriendChecklist friends={available} selected={selected} onSelected={setSelected} emptyText={dict.common.noData} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.common.cancel}</Button>
            <Button type="submit" disabled={saving || selectedIds.length === 0}>{saving ? dict.common.saving : dict.channels.invite}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FriendChecklist({ friends, selected, onSelected, emptyText = "暂无好友" }: { friends: Friend[]; selected: Record<string, boolean>; onSelected: (value: Record<string, boolean>) => void; emptyText?: string }) {
  if (friends.length === 0) return <p className="text-sm text-[--color-text-muted]">{emptyText}</p>
  return (
    <div className="max-h-64 overflow-y-auto rounded-[--radius-md] border border-[--color-border]">
      {friends.map((friend) => (
        <label key={friend.id} className="flex cursor-pointer items-center gap-3 border-b border-[--color-border] p-3 last:border-b-0 hover:bg-[--color-bg-hover]">
          <input
            type="checkbox"
            checked={Boolean(selected[friend.id])}
            onChange={(event) => onSelected({ ...selected, [friend.id]: event.target.checked })}
          />
          <UserAvatar size="sm" name={friend.displayName} email={friend.email} avatarText={friend.avatarText} avatarUrl={friend.avatarUrl} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{friend.displayName || friend.email}</span>
            <span className="block truncate text-xs text-[--color-text-muted]">{friend.email}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, File as FileIcon, Loader2, Megaphone, Menu, MessageCircle, Paperclip, Plus, RefreshCcw, Send, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { GroupAvatar } from "@/components/group-avatar"
import { deleteChatOutboxItem, listChatOutboxItems, saveChatOutboxItem, type ChatOutboxItem } from "@/lib/chat-outbox"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

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

type Channel = {
  id: string
  type: string
  name: string
  members: Friend[]
}

type ChannelAttachment = {
  id: string
  originalName: string
  mimeType: string
  size: number
  downloadUrl: string
}

type ChannelMessage = {
  id: string
  channelId: string
  senderId: string
  sender: Friend
  text: string
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: { id: string; url: string; name?: string; originalName?: string; isAnimated?: boolean } | null
  createdAt: string
  attachments: ChannelAttachment[]
  localStatus?: "sending" | "failed"
}

const WORLD_CHANNEL_ID = "world"
const INPUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const TIME_GAP_MS = 5 * 60 * 1000
const noopWorldAnnouncement = () => {}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
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
}: {
  channelId: string
  text: string
  files: File[]
  sticker?: StickerPick | null
  publishToAnnouncement: boolean
}) {
  return new Promise<ChannelMessage>((resolve, reject) => {
    const form = new FormData()
    form.set("text", text)
    if (sticker?.type === "asset") form.set("stickerId", sticker.id)
    if (sticker?.type === "emoji") form.set("stickerEmoji", sticker.emoji)
    form.set("publishToAnnouncement", publishToAnnouncement ? "true" : "false")
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

function outboxToChannelMessage(item: ChatOutboxItem, currentUserId: string): ChannelMessage {
  return {
    id: item.id,
    channelId: item.conversationId,
    senderId: currentUserId,
    sender: { id: currentUserId, email: "", displayName: "我", avatarText: "", avatarUrl: null },
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
    localStatus: "failed",
  }
}

export function AnnouncementChannelBar({ initialAnnouncements, userId }: { initialAnnouncements: AnnouncementItem[]; userId: string }) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [historyAnnouncements, setHistoryAnnouncements] = useState<AnnouncementItem[]>([])
  const [broadcastHistory, setBroadcastHistory] = useState<AnnouncementItem[]>([])
  const latest = announcements[0]
  const latestId = latest?.id
  const latestType = latest?.type ?? "announcement"
  const latestLabel = latestType === "broadcast" ? "世界频道" : "公告"

  const refreshAnnouncements = useCallback(async () => {
    const res = await fetch("/api/announcement-feed", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    setAnnouncements(Array.isArray(data.items) ? data.items : [])
  }, [])

  const loadHistory = useCallback(async () => {
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
        <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 text-primary-foreground hover:text-primary-foreground md:hidden">
          <Link href="/channels">
            <MessageCircle size={14} />
            频道
          </Link>
        </Button>
        <Button type="button" size="sm" onClick={() => setOpen(true)} className="hidden h-9 shrink-0 gap-1.5 md:inline-flex">
          <MessageCircle size={14} />
          频道
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
              <button type="button" onClick={hideLatest} className="shrink-0 text-[--color-text-muted] hover:text-[--color-text-primary]" title="隐藏">
                <X size={14} />
              </button>
            </div>
          ) : (
            <p className="truncate text-sm text-[--color-text-muted]">暂无公告</p>
          )}
        </div>
        <button type="button" onClick={() => { setHistoryOpen(true); void loadHistory() }} className="shrink-0 text-xs text-[--color-link] hover:text-[--color-accent]">
          历史
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-[min(96vw,980px)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <SheetHeader className="border-b border-[--color-border] px-4 py-3">
            <SheetTitle className="text-base">频道</SheetTitle>
          </SheetHeader>
          <GroupChatClient userId={userId} onWorldAnnouncement={refreshAnnouncements} />
        </SheetContent>
      </Sheet>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>公告历史</DialogTitle>
            <DialogDescription>近期公告和世界频道广播。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {historyAnnouncements.length === 0 && broadcastHistory.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">暂无历史记录</p>
            ) : null}
            {[...historyAnnouncements, ...broadcastHistory].map((item) => (
              <div key={`${item.type ?? "announcement"}-${item.id}`} className="rounded-[--radius-md] border border-[--color-border] p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                <p className="mt-2 text-xs text-[--color-text-muted]">
                  {formatChatTime(item.createdAt)} / {item.type === "broadcast" ? "世界频道" : "管理员"} / {item.author.displayName || item.author.email}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={loadHistory}>刷新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function GroupChatClient({ userId, onWorldAnnouncement = noopWorldAnnouncement }: { userId: string; onWorldAnnouncement?: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [selectedId, setSelectedId] = useState(WORLD_CHANNEL_ID)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [publishToAnnouncement, setPublishToAnnouncement] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [profileUser, setProfileUser] = useState<Friend | null>(null)
  const [previewImage, setPreviewImage] = useState<ChannelAttachment | null>(null)
  const [channelMenuOpen, setChannelMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0]
  const isWorld = selected?.id === WORLD_CHANNEL_ID
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends])
  const inputDraftKey = selectedId ? userStorageKey(userId, "chat-input", `channel:${selectedId}`) : ""

  const loadChannels = useCallback(async () => {
    const [channelRes, friendRes] = await Promise.all([
      fetch("/api/channels", { cache: "no-store" }),
      fetch("/api/friends", { cache: "no-store" }),
    ])
    const channelData = await channelRes.json().catch(() => ({}))
    const friendData = await friendRes.json().catch(() => [])
    if (!channelRes.ok) throw new Error(channelData.error ?? "加载频道失败")
    setCurrentUserId(channelData.currentUserId ?? "")
    setChannels(Array.isArray(channelData.items) ? channelData.items : [])
    setFriends(Array.isArray(friendData) ? friendData : [])
  }, [])

  const loadMessages = useCallback(async (channelId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/channels/${channelId}/messages?limit=50&_t=${Date.now()}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "加载消息失败")
      const restoredDrafts = await listChatOutboxItems(userId, "channel", channelId)
      const items = Array.isArray(data.items) ? data.items : []
      setMessages([...items, ...restoredDrafts.map((item) => outboxToChannelMessage(item, currentUserId || userId))])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载消息失败")
    } finally {
      setLoading(false)
    }
  }, [currentUserId, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadChannels().catch((error) => toast.error(error instanceof Error ? error.message : "加载频道失败"))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadChannels])

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
    const savedText = inputDraftKey
      ? readUserStorage<{ text: string }>({ kind: "session", key: inputDraftKey, userId, ttlMs: INPUT_DRAFT_TTL_MS })?.text ?? ""
      : ""
    const timer = window.setTimeout(() => {
      setText(savedText)
      void loadMessages(selectedId)
    }, 0)
    const source = new EventSource(`/api/channels/${selectedId}/events`)
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChannelMessage
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
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, selectedId])

  async function sendMessage(stickerOverride?: StickerPick | null) {
    const activeSticker = stickerOverride ?? sticker
    const immediateAsset = activeSticker?.type === "asset"
    const draft = immediateAsset ? "" : text.trim()
    const draftFiles = immediateAsset ? [] : files
    if (!selected || (!draft && draftFiles.length === 0 && !activeSticker) || sending) return
    const clientMutationId = crypto.randomUUID()
    const localId = `local-${clientMutationId}`
    const localMessage: ChannelMessage = {
      id: localId,
      channelId: selected.id,
      senderId: currentUserId || userId,
      sender: { id: currentUserId || userId, email: "", displayName: "我", avatarText: "", avatarUrl: null },
      text: draft,
      stickerId: activeSticker?.type === "asset" ? activeSticker.id : null,
      stickerEmoji: activeSticker?.type === "emoji" ? activeSticker.emoji : null,
      sticker: activeSticker?.type === "asset" ? { id: activeSticker.id, url: activeSticker.url, name: activeSticker.name } : null,
      createdAt: new Date().toISOString(),
      attachments: draftFiles.map((file, index) => ({
        id: `${localId}-${index}`,
        originalName: file.name || "file",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        downloadUrl: URL.createObjectURL(file),
      })),
      localStatus: "sending",
    }
    setMessages((current) => [...current, localMessage])
    if (!immediateAsset) {
      removeUserStorage("session", inputDraftKey)
      setText("")
      setFiles([])
    }
    setSticker(null)
    setSending(true)
    try {
      const shouldPublish = isWorld && publishToAnnouncement
      const created = await uploadChannelMessage({ channelId: selected.id, text: draft, files: draftFiles, sticker: activeSticker, publishToAnnouncement: shouldPublish })
      setMessages((current) => current.map((item) => item.id === localId ? created : item))
      await deleteChatOutboxItem(localId)
      if (shouldPublish && draft) onWorldAnnouncement()
      setPublishToAnnouncement(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败"
      await saveChatOutboxItem({
        id: localId,
        clientMutationId,
        userId,
        conversationType: "channel",
        conversationId: selected.id,
        text: draft,
        sticker: activeSticker ?? null,
        files: draftFiles,
        createdAt: Date.now(),
        lastError: message,
      }).catch((saveError) => {
        toast.error(saveError instanceof Error ? saveError.message : "保存重试消息失败")
      })
      setMessages((current) => current.map((item) => item.id === localId ? { ...item, localStatus: "failed" } : item))
      toast.error(message)
    } finally {
      setSending(false)
    }
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
      const message = error instanceof Error ? error.message : "发送失败"
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

  return (
    <div className="relative flex min-h-0 w-full max-w-full flex-1 overflow-hidden md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <button
        type="button"
        aria-label="关闭频道"
        onClick={() => setChannelMenuOpen(false)}
        className={`absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px] transition-opacity md:hidden ${channelMenuOpen ? "block" : "hidden"}`}
      />
      <aside className={`absolute inset-y-0 left-0 z-20 isolate flex min-h-0 w-[min(82vw,280px)] flex-col border-r border-[--color-border] bg-[--color-bg-primary]/95 shadow-xl backdrop-blur-md transition-transform duration-200 md:static md:z-auto md:w-auto md:translate-x-0 md:bg-[--color-bg-primary] md:shadow-none md:backdrop-blur-none ${channelMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[--color-border] bg-[--color-bg-primary]/95 p-3 backdrop-blur-md md:bg-transparent md:backdrop-blur-none">
          <p className="text-sm font-semibold">频道</p>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => {
                setSelectedId(channel.id)
                setChannelMenuOpen(false)
              }}
              className={`flex w-full min-w-0 items-center gap-3 border-b border-[--color-border] px-3 py-3 text-left hover:bg-[--color-bg-hover] ${selectedId === channel.id ? "bg-[--color-bg-hover]" : "bg-[--color-bg-primary]/90"}`}
            >
              {channel.type === "world" ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] border border-[--color-border] bg-[--color-bg-hover] text-[--color-text-secondary]">
                  <MessageCircle size={20} />
                </div>
              ) : (
                <GroupAvatar members={channel.members} name={channel.name} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{channel.name}</span>
                <span className="block truncate text-xs text-[--color-text-muted]">{channel.type === "world" ? "全部用户" : `${channel.members.length} 位成员`}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 w-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[--color-border] px-3 py-3 sm:px-4">
          <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2 md:hidden" onClick={() => setChannelMenuOpen(true)}>
            <Menu size={15} />
            <span>频道</span>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected?.name ?? "频道"}</p>
            <p className="truncate text-xs text-[--color-text-muted]">
              {isWorld ? "世界频道消息可以同步广播到公告栏。" : selected?.members.map((member) => member.displayName || member.email).join(", ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isWorld && (
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setInviteOpen(true)}>
                <UserPlus size={14} />
                <span className="hidden sm:inline">邀请</span>
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => selected && loadMessages(selected.id)}>
              <RefreshCcw size={14} />
              <span className="hidden sm:inline">刷新</span>
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[--color-text-muted]">加载消息中...</p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[--color-text-muted]">还没有消息。</p>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={message.id}>
                  {shouldShowTime(messages[index - 1], message) && (
                    <p className="my-4 text-center font-mono text-xs text-[--color-text-muted]">{formatChatTime(message.createdAt)}</p>
                  )}
                  <ChannelMessageBubble
                    message={message}
                    mine={message.senderId === (currentUserId || userId)}
                    onUserClick={setProfileUser}
                    onImagePreview={setPreviewImage}
                    onRetry={retryFailedMessage}
                    onDiscard={discardFailedMessage}
                  />
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="border-t border-[--color-border] px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`} className="inline-flex max-w-[220px] items-center gap-1 rounded border border-[--color-border] px-2 py-1 text-xs">
                  <FileIcon size={13} />
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {sticker?.type === "asset" && (
          <div className="border-t border-[--color-border] px-4 py-2">
            <span className="inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-hover] px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain" />
              <button type="button" onClick={() => setSticker(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">
                <X size={13} />
              </button>
            </span>
          </div>
        )}

        <form
          className="wechat-composer p-3"
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
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="输入消息..."
              className="wechat-composer-input max-h-32 flex-1 resize-none px-3 py-3 text-sm text-[--color-text-primary]"
            />
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
              {isWorld && (
                <button
                  type="button"
                  onClick={() => setPublishToAnnouncement((value) => !value)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-sm] transition-colors ${publishToAnnouncement ? "bg-[--color-warning-bg] text-[--color-warning]" : "text-[--color-text-muted] hover:bg-[#ededed]"}`}
                  title="同步广播这条世界频道消息"
                >
                  <Megaphone size={16} fill={publishToAnnouncement ? "currentColor" : "none"} />
                </button>
              )}
              <div className="flex-1" />
              <Button type="submit" size="sm" disabled={sending || (!text.trim() && files.length === 0 && !sticker)} className="h-9 shrink-0 rounded-md bg-[#f0f0f0] px-5 text-sm font-normal text-[#9b9b9b] shadow-none hover:bg-[#e8e8e8] enabled:bg-[#3b82f6] enabled:text-white">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} className="sm:hidden" />}
                <span>{sending ? "发送中" : "发送"}</span>
              </Button>
            </div>
          </div>
        </form>
      </main>

      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        friends={friends}
        onCreated={(channel) => {
          setChannels((current) => [current.find((item) => item.id === WORLD_CHANNEL_ID)!, channel, ...current.filter((item) => item.id !== WORLD_CHANNEL_ID)])
          setSelectedId(channel.id)
        }}
      />
      {selected && (
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
      <UserProfileDialog
        user={profileUser}
        currentUserId={currentUserId || userId}
        isFriend={profileUser ? friendIds.has(profileUser.id) : false}
        onOpenChange={(open) => !open && setProfileUser(null)}
      />
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

function ChannelMessageBubble({
  message,
  mine,
  onUserClick,
  onImagePreview,
  onRetry,
  onDiscard,
}: {
  message: ChannelMessage
  mine: boolean
  onUserClick: (user: Friend) => void
  onImagePreview: (attachment: ChannelAttachment) => void
  onRetry: (messageId: string) => void
  onDiscard: (messageId: string) => void
}) {
  const assetStickerOnly = !message.text && !message.stickerEmoji && Boolean(message.sticker) && message.attachments.length === 0
  const imageOnly = !message.text && !message.stickerEmoji && !message.sticker && message.attachments.length > 0 && message.attachments.every((attachment) => attachment.mimeType.startsWith("image/"))
  return (
    <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <button type="button" onClick={() => onUserClick(message.sender)} className="mt-5 shrink-0">
          <UserAvatar size="sm" name={message.sender.displayName} email={message.sender.email} avatarText={message.sender.avatarText} avatarUrl={message.sender.avatarUrl} />
        </button>
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <p className="mb-1 max-w-full truncate text-xs text-[--color-text-muted]">{message.sender.displayName || message.sender.email}</p>
        <div className={(assetStickerOnly || imageOnly) ? "" : `wechat-bubble px-3 py-2 text-[--color-text-primary] ${mine ? "wechat-bubble-right" : "wechat-bubble-left"}`}>
          {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
          {message.stickerEmoji && <p className="text-5xl leading-none">{message.stickerEmoji}</p>}
          {message.sticker && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.sticker.url} alt={message.sticker.name || message.sticker.originalName || "sticker"} className={assetStickerOnly ? "max-h-36 max-w-36 object-contain" : "max-h-32 max-w-32 object-contain"} />
          )}
          {message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} mine={mine} onPreview={onImagePreview} />)}
            </div>
          )}
          {message.localStatus && (
            <div className="mt-1 text-right font-mono text-[10px] text-[--color-text-muted]">
              <span>{message.localStatus === "sending" ? "发送中..." : "发送失败"}</span>
              {message.localStatus === "failed" && (
                <div className="mt-1 flex justify-end gap-2">
                  <button type="button" onClick={() => onRetry(message.id)} className="text-[--color-link] hover:underline">重试</button>
                  <button type="button" onClick={() => onDiscard(message.id)} className="text-[--color-danger] hover:underline">放弃</button>
                </div>
              )}
            </div>
          )}
        </div>
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

function UserProfileDialog({ user, currentUserId, isFriend, onOpenChange }: { user: Friend | null; currentUserId: string; isFriend: boolean; onOpenChange: (open: boolean) => void }) {
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const isSelf = user?.id === currentUserId

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
      if (!res.ok) throw new Error(data.error ?? "好友申请发送失败")
      toast.success(data.message ?? "好友申请已发送")
      setNote("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "好友申请发送失败")
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
              <p className="text-sm text-[--color-text-muted]">这是你自己。</p>
            ) : isFriend ? (
              <DialogFooter>
                <Button asChild variant="outline">
                  <Link href={`/u/${user.id}`}>主页</Link>
                </Button>
                <Button asChild>
                  <Link href={`/friends/chat/${user.id}`}>私聊</Link>
                </Button>
              </DialogFooter>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={120}
                  rows={3}
                  placeholder="好友申请备注"
                  className="w-full resize-none rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm outline-none focus:border-[--color-accent]"
                />
                <DialogFooter>
                  <Button type="button" onClick={sendFriendRequest} disabled={sending || !note.trim()}>
                    {sending ? "发送中..." : "添加好友"}
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
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected])

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
      if (!res.ok) throw new Error(data.error ?? "创建群组失败")
      onCreated(data)
      setName("")
      setSelected({})
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建群组失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={createGroup}>
          <DialogHeader>
            <DialogTitle>创建群组</DialogTitle>
            <DialogDescription>选择要加入群组的好友。</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="群组名称" className="w-full rounded-[--radius-sm] border border-[--color-border] px-3 py-2 text-sm outline-none focus:border-[--color-accent]" />
            <FriendChecklist friends={friends} selected={selected} onSelected={setSelected} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? "创建中..." : "创建"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChannelInviteDialog({ open, onOpenChange, channel, friends, onMembers }: { open: boolean; onOpenChange: (open: boolean) => void; channel: Channel; friends: Friend[]; onMembers: (members: Friend[]) => void }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const memberIds = new Set(channel.members.map((member) => member.id))
  const available = friends.filter((friend) => !memberIds.has(friend.id))
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected])

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
      if (!res.ok) throw new Error(data.error ?? "邀请失败")
      onMembers(Array.isArray(data.members) ? data.members : channel.members)
      setSelected({})
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "邀请失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={invite}>
          <DialogHeader>
            <DialogTitle>邀请好友</DialogTitle>
            <DialogDescription>把可邀请的好友加入这个群组。</DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <FriendChecklist friends={available} selected={selected} onSelected={setSelected} emptyText="暂无可邀请好友" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving || selectedIds.length === 0}>{saving ? "邀请中..." : "邀请"}</Button>
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

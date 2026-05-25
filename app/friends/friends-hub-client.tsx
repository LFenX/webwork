"use client"

import Link from "next/link"
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  Info,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react"
import { ChatPanel, type ChatFriend, type ChatSummary, messagePreview, presenceLabel, useChatSession } from "@/components/friend-chat"
import { GroupAvatar } from "@/components/group-avatar"
import { GroupChatClient, type Channel, type ChannelSummary } from "@/components/announcement-channel-bar"
import { SoulWingReplyButton } from "@/components/chat/soulwing-reply-button"
import { FriendsHubInnerLoading } from "@/components/loading/app-loading-states"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getActiveChatContext, subscribeActiveChatContext } from "@/lib/active-chat"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { publicProfileHref } from "@/lib/public-profile"

type HubTab = "all" | "direct" | "channel" | "requests"
type ConversationKind = "direct" | "channel"

export type InitialConversation = {
  type?: ConversationKind
  id?: string
  discussion?: string
}

interface Friend extends ChatFriend {
  bio: string
  presenceStatus: "online" | "away" | "offline"
  friendshipId: string
}

interface FriendRequest {
  id: string
  from: { id: string; email: string; displayName: string }
  to: { id: string; email: string; displayName: string }
  note: string
  status: string
  createdAt: string
}

type FriendData = {
  friends: Friend[]
  received: FriendRequest[]
  sent: FriendRequest[]
  summaries: ChatSummary[]
}

type ChannelData = {
  channels: Channel[]
  summaries: ChannelSummary[]
}

type ConversationItem =
  | {
      kind: "direct"
      id: string
      title: string
      subtitle: string
      preview: string
      latestAt?: string | null
      unread: number
      friend: Friend
    }
  | {
      kind: "channel"
      id: string
      title: string
      subtitle: string
      preview: string
      latestAt?: string | null
      unread: number
      channel: Channel
      roundtableActive?: boolean
    }

const FRIEND_CACHE_TTL_MS = 90 * 1000
const FRIEND_PRESENCE_REFRESH_MS = 60_000
const WORLD_CHANNEL_ID = "world"
const SOULWING_ROUNDTABLE_CHANNEL_ID = "soulwing-roundtable"
const CHANNEL_SEEN_STORAGE_NAMESPACE = "channel-seen-count"
const CHANNEL_SEEN_STORAGE_ID = "channels"
const CHANNEL_SEEN_COUNTS_CHANGED_EVENT = "channel-seen-counts-changed"
const CHANNEL_SUMMARY_TTL_MS = 30 * 24 * 60 * 60 * 1000

function formatChatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
  if (diffDays <= 0) return time
  if (diffDays < 7) return `${date.toLocaleDateString("zh-CN", { weekday: "short" })} ${time}`
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
}

function channelSeenStorageKey(userId: string) {
  return userStorageKey(userId, CHANNEL_SEEN_STORAGE_NAMESPACE, CHANNEL_SEEN_STORAGE_ID)
}

function emitChannelSeenCountsChanged(value: Record<string, number>) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, { detail: value }))
}

function addRoundtableChannel(channels: Channel[]): Channel[] {
  const roundtable: Channel = {
    id: SOULWING_ROUNDTABLE_CHANNEL_ID,
    type: "soulwing-roundtable",
    name: "蝶灵圆桌",
    announcement: "特殊群聊 · 蝶灵发言",
    ownerId: null,
    ownerName: null,
    currentUserRole: null,
    members: [],
  }
  if (channels.some((channel) => channel.id === SOULWING_ROUNDTABLE_CHANNEL_ID)) return channels
  const worldIndex = channels.findIndex((channel) => channel.id === WORLD_CHANNEL_ID)
  if (worldIndex < 0) return [roundtable, ...channels]
  return [...channels.slice(0, worldIndex + 1), roundtable, ...channels.slice(worldIndex + 1)]
}

async function fetchFriendData(): Promise<FriendData> {
  const activeContext = getActiveChatContext()
  const summaryParams = new URLSearchParams()
  if (activeContext?.kind === "direct") summaryParams.set("activeFriendId", activeContext.id)
  const summaryUrl = summaryParams.size > 0 ? `/api/chats/summary?${summaryParams.toString()}` : "/api/chats/summary"
  const responses = await Promise.all([
    fetch("/api/friends", { cache: "no-store" }),
    fetch("/api/friend-requests?direction=received", { cache: "no-store" }),
    fetch("/api/friend-requests?direction=sent", { cache: "no-store" }),
    fetch(summaryUrl, { cache: "no-store" }),
  ])
  if (responses.some((response) => !response.ok)) throw new Error("好友数据加载失败")
  const [friends, received, sent, summary] = await Promise.all(responses.map((response) => response.json()))
  return {
    friends: Array.isArray(friends) ? friends : [],
    received: Array.isArray(received) ? received : [],
    sent: Array.isArray(sent) ? sent : [],
    summaries: Array.isArray(summary.items) ? summary.items : [],
  }
}

async function fetchChannelData(): Promise<ChannelData> {
  const [channelRes, summaryRes] = await Promise.all([
    fetch("/api/channels", { cache: "no-store" }),
    fetch("/api/channels/summary", { cache: "no-store" }),
  ])
  if (!channelRes.ok || !summaryRes.ok) throw new Error("群聊数据加载失败")
  const [channelData, summaryData] = await Promise.all([channelRes.json(), summaryRes.json()])
  return {
    channels: addRoundtableChannel(Array.isArray(channelData.items) ? channelData.items : []),
    summaries: Array.isArray(summaryData.items) ? summaryData.items : [],
  }
}

export function FriendsHubClient({
  userId,
  currentUser,
  initialConversation,
}: {
  userId: string
  currentUser: ChatFriend
  initialConversation: InitialConversation
}) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [received, setReceived] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [directSummaries, setDirectSummaries] = useState<Record<string, ChatSummary>>({})
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelSummaries, setChannelSummaries] = useState<Record<string, ChannelSummary>>({})
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({})
  const [roundtableActive, setRoundtableActive] = useState(false)
  const [selected, setSelected] = useState<{ kind: ConversationKind; id: string } | null>(null)
  const [requestedConversation, setRequestedConversation] = useState<InitialConversation>(initialConversation)
  const [activeTab, setActiveTab] = useState<HubTab>(initialConversation.type ?? "all")
  const [query, setQuery] = useState("")
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(initialConversation.id))
  const [addOpen, setAddOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [requestNote, setRequestNote] = useState("")
  const [requestSending, setRequestSending] = useState(false)
  const [unfriendTarget, setUnfriendTarget] = useState<Friend | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [, startTransition] = useTransition()
  const didInitializeRef = useRef(false)
  const friendCacheKey = userStorageKey(userId, "friends-cache", "hub")
  const selectedFriend = selected?.kind === "direct" ? friends.find((friend) => friend.id === selected.id) ?? null : null

  const refreshDirectSummary = useCallback(async () => {
    const activeContext = getActiveChatContext()
    const params = new URLSearchParams()
    if (activeContext?.kind === "direct") params.set("activeFriendId", activeContext.id)
    const response = await fetch(params.size > 0 ? `/api/chats/summary?${params.toString()}` : "/api/chats/summary", { cache: "no-store" }).catch(() => null)
    if (!response?.ok) return
    const data = await response.json().catch(() => ({}))
    const items = Array.isArray(data.items) ? data.items as ChatSummary[] : []
    setDirectSummaries(Object.fromEntries(items.map((item) => [item.friendId, item])))
  }, [])

  const chat = useChatSession(selected?.kind === "direct" ? selected.id : null, selectedFriend, refreshDirectSummary, currentUser)

  const persistSeenCounts = useCallback((value: Record<string, number>) => {
    writeUserStorage({ kind: "local", key: channelSeenStorageKey(userId), userId, value })
    emitChannelSeenCountsChanged(value)
  }, [userId])

  const loadChannels = useCallback(async () => {
    const data = await fetchChannelData()
    const byId = Object.fromEntries(data.summaries.map((item) => [item.channelId, item]))
    setChannels(data.channels)
    setChannelSummaries(byId)
    setSeenCounts((current) => {
      if (Object.keys(current).length > 0) return current
      const stored = readUserStorage<Record<string, number>>({
        kind: "local",
        key: channelSeenStorageKey(userId),
        userId,
        ttlMs: CHANNEL_SUMMARY_TTL_MS,
      })
      if (stored) return stored
      const initial = Object.fromEntries(data.summaries.map((item) => [item.channelId, item.totalCount]))
      persistSeenCounts(initial)
      return initial
    })
  }, [persistSeenCounts, userId])

  const loadRoundtablePulse = useCallback(async () => {
    const response = await fetch("/api/soulwing-roundtable", { cache: "no-store" }).catch(() => null)
    if (!response?.ok) return
    const data = await response.json().catch(() => ({}))
    setRoundtableActive(Boolean(data.isDiscussing))
  }, [])

  const loadAll = useCallback(async ({
    showLoading = true,
    useCache = true,
    showRefreshing = showLoading,
  }: {
    showLoading?: boolean
    useCache?: boolean
    showRefreshing?: boolean
  } = {}) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const cached = useCache
        ? readUserStorage<FriendData>({ kind: "session", key: friendCacheKey, userId, ttlMs: FRIEND_CACHE_TTL_MS })
        : null
      if (cached && showLoading) {
        setFriends(cached.friends)
        setReceived(cached.received)
        setSent(cached.sent)
        setDirectSummaries(Object.fromEntries(cached.summaries.map((item) => [item.friendId, item])))
        setInitialLoading(false)
      } else if (showLoading) {
        setInitialLoading(true)
      }
      const [friendData] = await Promise.all([fetchFriendData(), loadChannels(), loadRoundtablePulse()])
      startTransition(() => {
        setFriends(friendData.friends)
        setReceived(friendData.received)
        setSent(friendData.sent)
        setDirectSummaries(Object.fromEntries(friendData.summaries.map((item) => [item.friendId, item])))
      })
      writeUserStorage({ kind: "session", key: friendCacheKey, userId, value: friendData })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载失败")
    } finally {
      if (showLoading) setInitialLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }, [friendCacheKey, loadChannels, loadRoundtablePulse, startTransition, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAll])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      removeUserStorage("session", friendCacheKey)
      void loadAll({ showLoading: false, useCache: false })
    }
    const timer = window.setInterval(refresh, FRIEND_PRESENCE_REFRESH_MS)
    const unsubscribeActiveChat = subscribeActiveChatContext(() => void refreshDirectSummary())
    window.addEventListener("focus", refresh)
    window.addEventListener("chat-unread-refresh", refreshDirectSummary)
    window.addEventListener("presence-refresh", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("chat-unread-refresh", refreshDirectSummary)
      window.removeEventListener("presence-refresh", refresh)
      unsubscribeActiveChat()
    }
  }, [friendCacheKey, loadAll, refreshDirectSummary])

  useEffect(() => {
    const onSeen = (event: Event) => {
      const next = (event as CustomEvent<Record<string, number>>).detail
      if (next && typeof next === "object") setSeenCounts(next)
    }
    const onRealtime = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type === "channel:message") {
        void loadChannels()
      }
      if (payload?.type === "chat:message" || payload?.type === "chat:read") {
        void refreshDirectSummary()
      }
    }
    window.addEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeen)
    window.addEventListener("app:realtime", onRealtime)
    return () => {
      window.removeEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeen)
      window.removeEventListener("app:realtime", onRealtime)
    }
  }, [loadChannels, refreshDirectSummary])

  const conversations = useMemo<ConversationItem[]>(() => {
    const directItems: ConversationItem[] = friends.map((friend) => {
      const summary = directSummaries[friend.id]
      return {
        kind: "direct",
        id: friend.id,
        title: friend.displayName || friend.email,
        subtitle: presenceLabel(friend.presenceStatus),
        preview: messagePreview(summary),
        latestAt: summary?.latest?.createdAt,
        unread: summary?.unreadCount ?? 0,
        friend,
      }
    })
    const channelItems: ConversationItem[] = channels.map((channel) => {
      const summary = channelSummaries[channel.id]
      const unread = channel.id === SOULWING_ROUNDTABLE_CHANNEL_ID
        ? 0
        : Math.max((summary?.totalCount ?? 0) - (seenCounts[channel.id] ?? summary?.totalCount ?? 0), 0)
      return {
        kind: "channel",
        id: channel.id,
        title: channel.name,
        subtitle: channel.type === "world" ? "世界频道" : channel.type === "soulwing-roundtable" ? "蝶灵圆桌" : `${channel.members.length} 位成员`,
        preview: summary?.latest?.text?.trim() || channel.announcement || (channel.type === "world" ? "所有成员都能看见这里的消息" : "暂无群消息"),
        latestAt: summary?.latest?.createdAt,
        unread,
        channel,
        roundtableActive: channel.id === SOULWING_ROUNDTABLE_CHANNEL_ID && roundtableActive,
      }
    })
    return [...directItems, ...channelItems].sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread
      const at = a.latestAt ? new Date(a.latestAt).getTime() : 0
      const bt = b.latestAt ? new Date(b.latestAt).getTime() : 0
      return bt - at
    })
  }, [channelSummaries, channels, directSummaries, friends, roundtableActive, seenCounts])

  useEffect(() => {
    if (didInitializeRef.current || initialLoading || conversations.length === 0) return
    const timer = window.setTimeout(() => {
      const requested = requestedConversation.type && requestedConversation.id
        ? conversations.find((item) => item.kind === requestedConversation.type && item.id === requestedConversation.id)
        : null
      const fallback = conversations.find((item) => item.unread > 0) ?? conversations.find((item) => item.latestAt) ?? conversations.find((item) => item.kind === "channel" && item.id === WORLD_CHANNEL_ID) ?? conversations[0]
      const next = requested ?? fallback
      if (next) setSelected({ kind: next.kind, id: next.id })
      didInitializeRef.current = true
    }, 0)
    return () => window.clearTimeout(timer)
  }, [conversations, initialLoading, requestedConversation.id, requestedConversation.type])

  useEffect(() => {
    if (initialLoading || !requestedConversation.type || !requestedConversation.id) return
    const requested = conversations.find((item) => item.kind === requestedConversation.type && item.id === requestedConversation.id)
    if (!requested || (selected?.kind === requested.kind && selected.id === requested.id)) return
    const timer = window.setTimeout(() => {
      setSelected({ kind: requested.kind, id: requested.id })
      setActiveTab(requested.kind === "channel" ? "channel" : "direct")
      setMobileThreadOpen(true)
      didInitializeRef.current = true
    }, 0)
    return () => window.clearTimeout(timer)
  }, [conversations, initialLoading, requestedConversation.id, requestedConversation.type, selected?.id, selected?.kind])

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return conversations.filter((item) => {
      if (activeTab === "direct" && item.kind !== "direct") return false
      if (activeTab === "channel" && item.kind !== "channel") return false
      if (activeTab === "requests") return false
      if (!normalized) return true
      return `${item.title} ${item.subtitle} ${item.preview}`.toLowerCase().includes(normalized)
    })
  }, [activeTab, conversations, query])

  function openConversation(kind: ConversationKind, id: string) {
    setSelected({ kind, id })
    setRequestedConversation({ type: kind, id })
    setActiveTab(kind === "channel" ? "channel" : "direct")
    setMobileThreadOpen(true)
    const url = new URL(window.location.href)
    url.searchParams.set("type", kind)
    url.searchParams.set("id", id)
    if (kind !== "channel" || id !== SOULWING_ROUNDTABLE_CHANNEL_ID) url.searchParams.delete("discussion")
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`)
  }

  function selectConversation(item: ConversationItem) {
    openConversation(item.kind, item.id)
  }

  async function handleSendRequest() {
    if (!email.trim() || !requestNote.trim()) return
    setRequestSending(true)
    try {
      const response = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), note: requestNote.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "好友请求发送失败")
      toast.success(data.message ?? "好友请求已发送")
      setEmail("")
      setRequestNote("")
      setAddOpen(false)
      removeUserStorage("session", friendCacheKey)
      await loadAll({ showLoading: false, useCache: false, showRefreshing: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setRequestSending(false)
    }
  }

  async function handleRespond(id: string, action: "accept" | "reject") {
    const response = await fetch(`/api/friend-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (response.ok) {
      toast.success(action === "accept" ? "已接受好友请求" : "已拒绝好友请求")
      removeUserStorage("session", friendCacheKey)
      await loadAll({ showLoading: false, useCache: false, showRefreshing: true })
    } else {
      toast.error("操作失败")
    }
  }

  async function handleCancel(id: string) {
    const response = await fetch(`/api/friend-requests/${id}`, { method: "DELETE" })
    if (response.ok) {
      toast.success("已取消请求")
      removeUserStorage("session", friendCacheKey)
      await loadAll({ showLoading: false, useCache: false, showRefreshing: true })
    } else {
      toast.error("操作失败")
    }
  }

  async function handleUnfriend(friendshipId: string) {
    const response = await fetch(`/api/friend-requests/${friendshipId}`, { method: "DELETE" })
    if (response.ok) {
      toast.success("已解除好友关系")
      setUnfriendTarget(null)
      removeUserStorage("session", friendCacheKey)
      await loadAll({ showLoading: false, useCache: false, showRefreshing: true })
    } else {
      toast.error("操作失败")
    }
  }

  const requestsCount = received.length + sent.length
  const activeConversation = selected ? conversations.find((item) => item.kind === selected.kind && item.id === selected.id) ?? null : null

  if (initialLoading) {
    return <FriendsHubInnerLoading />
  }

  return (
    <div className="friends-hub-viewport mobile-chat-viewport flex h-full min-h-0 flex-col gap-4">
      <div className="hidden items-end justify-between gap-4 lg:flex">
        <div>
          <h1 className="text-[32px] font-bold tracking-normal text-slate-950">好友与群聊</h1>
          <p className="mt-2 text-sm text-slate-500">好友关系、私聊、群聊和世界频道都收在这里。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" loading={refreshing} className="rounded-full border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => void loadAll({ showLoading: false, useCache: false, showRefreshing: true })}>
            <RefreshCcw size={15} />
            刷新
          </Button>
          <Button type="button" variant="outline" className="rounded-full border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => setGroupOpen(true)}>
            <UsersRound size={15} />
            创建群聊
          </Button>
          <Button type="button" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} />
            添加好友
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <aside className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]", mobileThreadOpen && "hidden lg:flex")}>
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <div>
                <h1 className="text-xl font-bold text-slate-950">好友与群聊</h1>
                <p className="text-xs text-slate-500">私聊和群聊都在这里</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="size-9 rounded-full border-blue-100 bg-white p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => setGroupOpen(true)} aria-label="创建群聊">
                  <UsersRound size={15} />
                </Button>
                <Button type="button" size="sm" className="size-9 rounded-full bg-blue-600 p-0 hover:bg-blue-700" onClick={() => setAddOpen(true)} aria-label="添加好友">
                  <Plus size={15} />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索好友 / 群聊"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
              {[
                ["all", "全部", conversations.length],
                ["direct", "私聊", friends.length],
                ["channel", "群聊", channels.length],
                ["requests", "申请", requestsCount],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as HubTab)}
                  className={cn("min-h-8 rounded-full px-2 transition", activeTab === key ? "bg-white text-blue-600 shadow-sm" : "hover:text-slate-900")}
                >
                  {label}<span className="ml-1 font-mono text-[10px]">{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeTab === "requests" ? (
              <RequestsPanel
                received={received}
                sent={sent}
                onAccept={(id) => void handleRespond(id, "accept")}
                onReject={(id) => void handleRespond(id, "reject")}
                onCancel={(id) => void handleCancel(id)}
              />
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                暂时没有匹配的会话
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredConversations.map((item) => (
                  <ConversationRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    selected={selected?.kind === item.kind && selected.id === item.id}
                    onSelect={selectConversation}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className={cn("h-full min-h-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]", !mobileThreadOpen && "hidden lg:block")}>
          {activeConversation ? (
            activeConversation.kind === "direct" ? (
              <ChatPanel
                friend={selectedFriend}
                currentUser={currentUser}
                messages={chat.messages}
                loading={chat.loading}
                sending={chat.sending}
                hasOlder={chat.hasOlder}
                loadingOlder={chat.loadingOlder}
                text={chat.text}
                files={chat.files}
                sticker={chat.sticker}
                replyTo={chat.replyTo}
                onTextChange={chat.setText}
                onFilesChange={chat.setFiles}
                onStickerChange={chat.setSticker}
                onStickerPick={chat.pickSticker}
                onReplyChange={chat.setReplyTo}
                onSend={chat.sendMessage}
                onLoadOlder={chat.loadOlderMessages}
                onReload={chat.loadMessages}
                onRetryMessage={chat.retryMessage}
                onDiscardMessage={chat.discardMessage}
                userId={userId}
                className="h-full rounded-none border-0 shadow-none"
                headerPrefix={
                  <button type="button" onClick={() => setMobileThreadOpen(false)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="返回会话列表">
                    <ArrowLeft size={18} />
                  </button>
                }
                headerActions={
                  <Button type="button" size="sm" variant="outline" aria-label="会话资料" onClick={() => setInfoOpen(true)} className="inline-flex h-8 shrink-0 gap-1.5 rounded-full border-blue-100 bg-white px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-700 xl:hidden">
                    <Info size={13} />
                    <span className="hidden sm:inline">资料</span>
                  </Button>
                }
                composerExtra={
                  <SoulWingReplyButton
                    chatType="direct"
                    conversationId={selectedFriend?.id ?? ""}
                    onInsertDraft={(text) => chat.setText(text)}
                    onSend={undefined}
                  />
                }
              />
            ) : (
              <GroupChatClient
                key={`${activeConversation.kind}-${activeConversation.id}-${initialConversation.discussion ?? ""}`}
                userId={userId}
                currentUser={currentUser}
                initialChannelId={activeConversation.id}
                initialRoundtableDiscussionId={activeConversation.id === SOULWING_ROUNDTABLE_CHANNEL_ID ? initialConversation.discussion : undefined}
                hideSidebar
                className="h-full"
                headerPrefix={
                  <button type="button" onClick={() => setMobileThreadOpen(false)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="返回会话列表">
                    <ArrowLeft size={18} />
                  </button>
                }
                headerActions={
                  <Button type="button" size="sm" variant="outline" aria-label="会话资料" onClick={() => setInfoOpen(true)} className="inline-flex h-8 shrink-0 gap-1.5 rounded-full border-blue-100 bg-white px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-700 xl:hidden">
                    <Info size={13} />
                    <span className="hidden sm:inline">资料</span>
                  </Button>
                }
              />
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="text-blue-500" size={34} />
              <p className="mt-3 text-base font-semibold text-slate-900">选择一个会话</p>
              <p className="mt-1 text-sm text-slate-500">从左侧打开好友私聊、群聊或世界频道。</p>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:block">
          <InfoPanel
            conversation={activeConversation}
            onAddFriend={() => setAddOpen(true)}
            onUnfriend={setUnfriendTarget}
          />
        </aside>
      </div>

      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" overlay className="w-[min(92vw,360px)] rounded-l-[22px] border-slate-200 bg-white p-0">
          <SheetHeader className="border-b border-slate-100 px-5 py-4">
            <SheetTitle className="text-base">会话信息</SheetTitle>
          </SheetHeader>
          <InfoPanel conversation={activeConversation} onAddFriend={() => setAddOpen(true)} onUnfriend={setUnfriendTarget} />
        </SheetContent>
      </Sheet>

      <AddFriendDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        email={email}
        note={requestNote}
        sending={requestSending}
        onEmailChange={setEmail}
        onNoteChange={setRequestNote}
        onSubmit={() => void handleSendRequest()}
      />

      <CreateGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        friends={friends}
        onCreated={(channel) => {
          void (async () => {
            await loadChannels().catch(() => null)
            openConversation("channel", channel.id)
          })()
        }}
      />

      <Dialog open={Boolean(unfriendTarget)} onOpenChange={(open) => !open && setUnfriendTarget(null)}>
        <DialogContent overlay>
          <DialogHeader>
            <DialogTitle>解除好友关系？</DialogTitle>
            <DialogDescription>
              将不再能继续和 {unfriendTarget?.displayName || unfriendTarget?.email} 私聊，历史消息会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnfriendTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => unfriendTarget && void handleUnfriend(unfriendTarget.friendshipId)}>解除好友</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConversationRow({ item, selected, onSelect }: { item: ConversationItem; selected: boolean; onSelect: (item: ConversationItem) => void }) {
  const time = formatChatTime(item.latestAt)
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-[15px] px-3 py-3 text-left transition",
        selected ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "hover:bg-slate-50"
      )}
    >
      <span className="relative shrink-0">
        {item.kind === "direct" ? (
          <UserAvatar
            size="sm"
            name={item.friend.displayName}
            email={item.friend.email}
            avatarText={item.friend.avatarText}
            avatarUrl={item.friend.avatarUrl}
            presenceStatus={item.friend.presenceStatus}
          />
        ) : item.channel.type === "world" ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <MessageCircle size={17} />
          </span>
        ) : item.channel.type === "soulwing-roundtable" ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <Sparkles size={17} />
          </span>
        ) : (
          <GroupAvatar members={item.channel.members} name={item.channel.name} />
        )}
        {item.unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {item.unread > 99 ? "99+" : item.unread}
          </span>
        )}
        {item.kind === "channel" && item.roundtableActive && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-violet-500 ring-2 ring-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-500" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-950">{item.title}</span>
          {time && <span className="shrink-0 text-[11px] text-slate-400">{time}</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{item.preview}</span>
      </span>
    </button>
  )
}

function InfoPanel({
  conversation,
  onAddFriend,
  onUnfriend,
}: {
  conversation: ConversationItem | null
  onAddFriend: () => void
  onUnfriend: (friend: Friend) => void
}) {
  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
        <Info size={24} className="mb-2 text-blue-500" />
        选择会话后查看资料和快捷操作。
      </div>
    )
  }
  if (conversation.kind === "direct") {
    const friend = conversation.friend
    return (
      <div className="flex h-full flex-col p-5">
        <div className="flex flex-col items-center text-center">
          <UserAvatar size="lg" name={friend.displayName} email={friend.email} avatarText={friend.avatarText} avatarUrl={friend.avatarUrl} presenceStatus={friend.presenceStatus} />
          <h2 className="mt-3 text-lg font-semibold text-slate-950">{friend.displayName || friend.email}</h2>
          <p className="mt-1 text-sm text-slate-500">{friend.email}</p>
          <span className="mt-3 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">{presenceLabel(friend.presenceStatus)}</span>
        </div>
        {friend.bio && <p className="mt-5 rounded-[15px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">{friend.bio}</p>}
        <div className="mt-5 grid gap-2">
          <Button asChild className="rounded-full bg-blue-600 !text-white hover:bg-blue-700 hover:!text-white">
            <Link href={publicProfileHref(friend)}>查看主页</Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onUnfriend(friend)}>
            <UserMinus size={15} />
            解除好友
          </Button>
        </div>
      </div>
    )
  }
  const channel = conversation.channel
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        {channel.type === "world" ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <MessageCircle size={22} />
          </span>
        ) : channel.type === "soulwing-roundtable" ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
            <Sparkles size={22} />
          </span>
        ) : (
          <GroupAvatar members={channel.members} name={channel.name} />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-950">{channel.name}</h2>
          <p className="truncate text-sm text-slate-500">
            {channel.type === "world" ? "所有用户可见" : channel.type === "soulwing-roundtable" ? "AI 圆桌讨论" : `${channel.members.length} 位成员`}
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-[15px] bg-slate-50 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Bell size={13} />
          群公告
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{channel.announcement || "暂未设置群公告"}</p>
      </div>
      {channel.members.length > 0 && (
        <div className="mt-5 min-h-0">
          <p className="mb-2 text-xs font-semibold text-slate-500">成员</p>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {channel.members.map((member) => (
              <Link key={member.id} href={publicProfileHref(member)} className="flex items-center gap-2 rounded-[12px] px-2 py-2 hover:bg-slate-50 hover:no-underline">
                <UserAvatar size="sm" name={member.displayName} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{member.displayName || member.email}</span>
                  <span className="block truncate text-xs text-slate-500">{member.email}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto grid gap-2 pt-5">
        {channel.type === "group" && (
          <Button asChild variant="outline" className="rounded-full border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700">
            <Link href={`/channels/${channel.id}`}>管理群聊</Link>
          </Button>
        )}
        <Button type="button" variant="outline" className="rounded-full border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={onAddFriend}>
          <UserPlus size={15} />
          添加好友
        </Button>
      </div>
    </div>
  )
}

function RequestsPanel({
  received,
  sent,
  onAccept,
  onReject,
  onCancel,
}: {
  received: FriendRequest[]
  sent: FriendRequest[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onCancel: (id: string) => void
}) {
  if (received.length === 0 && sent.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        暂无好友申请
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {received.length > 0 && (
        <RequestGroup title={`收到的请求 (${received.length})`}>
          {received.map((request) => (
            <RequestCard key={request.id} name={request.from.displayName || request.from.email} email={request.from.email} note={request.note}>
              <Button size="sm" className="h-8 rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => onAccept(request.id)}>
                <Check size={13} />
                接受
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => onReject(request.id)}>
                <X size={13} />
                拒绝
              </Button>
            </RequestCard>
          ))}
        </RequestGroup>
      )}
      {sent.length > 0 && (
        <RequestGroup title={`已发送 (${sent.length})`}>
          {sent.map((request) => (
            <RequestCard key={request.id} name={request.to.displayName || request.to.email} email={request.to.email} note={request.note}>
              <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => onCancel(request.id)}>
                取消
              </Button>
            </RequestCard>
          ))}
        </RequestGroup>
      )}
    </div>
  )
}

function RequestGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Clock size={13} />
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function RequestCard({ name, email, note, children }: { name: string; email: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-[15px] border border-slate-100 bg-white p-3 shadow-sm">
      <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
      <p className="truncate text-xs text-slate-500">{email}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{note}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function AddFriendDialog({
  open,
  onOpenChange,
  email,
  note,
  sending,
  onEmailChange,
  onNoteChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  note: string
  sending: boolean
  onEmailChange: (value: string) => void
  onNoteChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlay className="sm:rounded-[18px]">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>添加好友</DialogTitle>
            <DialogDescription>输入对方邮箱，并附上一句申请说明。</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-3">
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="对方邮箱"
              className="h-11 rounded-[13px] border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={120}
              rows={3}
              placeholder="好友申请备注"
              className="resize-none rounded-[13px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={sending || !email.trim() || !note.trim()} className="bg-blue-600 hover:bg-blue-700">
              {sending ? "发送中..." : "发送好友请求"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateGroupDialog({
  open,
  onOpenChange,
  friends,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  friends: Friend[]
  onCreated: (channel: Channel) => void
}) {
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected])

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberIds: selectedIds }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.id) throw new Error(data.error ?? "群聊创建失败")
      toast.success("群聊已创建")
      setName("")
      setSelected({})
      onOpenChange(false)
      onCreated(data as Channel)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "群聊创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlay className="sm:rounded-[18px]">
        <form onSubmit={createGroup}>
          <DialogHeader>
            <DialogTitle>创建群聊</DialogTitle>
            <DialogDescription>选择好友加入群聊，也可以先创建后再邀请成员。</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="群聊名称"
              className="h-11 rounded-[13px] border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            <div className="max-h-72 overflow-y-auto rounded-[15px] border border-slate-200 bg-white">
              {friends.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">暂无好友，可先创建一个只包含自己的群聊。</p>
              ) : (
                friends.map((friend) => (
                  <label key={friend.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[friend.id])}
                      onChange={(event) => setSelected((current) => ({ ...current, [friend.id]: event.target.checked }))}
                      className="size-4 rounded border-slate-300 text-blue-600"
                    />
                    <UserAvatar size="sm" name={friend.displayName} email={friend.email} avatarText={friend.avatarText} avatarUrl={friend.avatarUrl} presenceStatus={friend.presenceStatus} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{friend.displayName || friend.email}</span>
                      <span className="block truncate text-xs text-slate-500">{friend.email}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving || !name.trim()} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "创建中..." : "创建群聊"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

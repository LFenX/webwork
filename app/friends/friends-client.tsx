"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Clock, MessageCircle, UserMinus, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChatPanel, type ChatFriend, type ChatSummary, messagePreview, presenceLabel, useChatSession } from "@/components/friend-chat"
import { SoulWingReplyButton } from "@/components/chat/soulwing-reply-button"
import { UserAvatar } from "@/components/user-avatar"
import { getActiveChatContext, subscribeActiveChatContext } from "@/lib/active-chat"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

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

type ViewMode = "friends" | "chat"
const FRIEND_CACHE_TTL_MS = 90 * 1000
const FRIEND_PRESENCE_REFRESH_MS = 60_000
const DESKTOP_CHAT_HEIGHT_STORAGE_KEY = "friends-desktop-chat-height"
const DESKTOP_CHAT_MIN_HEIGHT = 500
const DESKTOP_CHAT_MAX_HEIGHT = 980
const DESKTOP_CHAT_VIEWPORT_GAP = 90

type FriendData = {
  friends: Friend[]
  received: FriendRequest[]
  sent: FriendRequest[]
  summaries: ChatSummary[]
}

function getLabels() {
  const isEnglish = typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
  return isEnglish
    ? {
        loading: "Loading...",
        loadFailed: "Failed to load friend data",
        operationFailed: "Operation failed",
        requestSent: "Friend request sent",
        requestAccepted: "Request accepted",
        requestRejected: "Request rejected",
        requestCancelled: "Request cancelled",
        unfriended: "Friend removed",
        friends: "Friends",
        chat: "Chat",
        removeFriendTitle: "Remove friend?",
        removeFriendBody: "This will remove your friendship with",
        removeFriendHint: "Chat history will stay, but you will no longer be able to chat until you add each other again.",
        cancel: "Cancel",
        confirmRemove: "Remove friend",
        addFriend: "Add friend",
        emailPlaceholder: "Enter the other person's email",
        notePlaceholder: "Friend request note",
        sending: "Sending...",
        sendRequest: "Send friend request",
        receivedRequests: "Incoming requests",
        sentRequests: "Sent requests",
        myFriends: "My friends",
        noFriends: "You do not have any friends yet. Use the form on the left to add one.",
        online: "Online",
        offline: "Away / Offline",
        noOnlineFriends: "No friends are online right now.",
        noOfflineFriends: "Everyone is online right now.",
        noChatFriends: "You do not have any friends available for chat yet.",
        mobileHint: "On mobile, tap a friend above to open the full chat page.",
        openChat: "Chat",
        unfriend: "Remove",
        note: "Note",
        accept: "Accept",
        reject: "Reject",
      }
    : {
        loading: "加载中...",
        loadFailed: "加载好友数据失败",
        operationFailed: "操作失败",
        requestSent: "好友请求已发送",
        requestAccepted: "已接受请求",
        requestRejected: "已拒绝请求",
        requestCancelled: "已取消请求",
        unfriended: "已解除好友关系",
        friends: "好友",
        chat: "聊天",
        removeFriendTitle: "确认解除好友？",
        removeFriendBody: "这将解除你与",
        removeFriendHint: "历史聊天记录会保留，但你们需要重新互加好友后才能继续聊天。",
        cancel: "取消",
        confirmRemove: "确认解除",
        addFriend: "添加好友",
        emailPlaceholder: "输入对方邮箱",
        notePlaceholder: "好友申请备注",
        sending: "发送中...",
        sendRequest: "发送好友请求",
        receivedRequests: "收到的好友请求",
        sentRequests: "已发出的请求",
        myFriends: "我的好友",
        noFriends: "还没有好友，可以通过左侧表单添加。",
        online: "在线",
        offline: "离线 / 离开",
        noOnlineFriends: "当前没有在线好友。",
        noOfflineFriends: "当前所有好友都在线。",
        noChatFriends: "还没有可以聊天的好友。",
        mobileHint: "在手机上点击上方好友即可进入独立聊天页。",
        openChat: "聊天",
        unfriend: "解除",
        note: "备注",
        accept: "接受",
        reject: "拒绝",
      }
}

function formatChatTime(value?: string | null) {
  if (!value) return ""
  const locale = typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en-US" : "zh-CN"
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false })

  if (diffDays <= 0) return time
  if (diffDays < 7) return `${date.toLocaleDateString(locale, { weekday: "short" })} ${time}`
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${time}`
}

function clampDesktopChatHeight(value: number, viewportHeight: number) {
  const viewportCap = Math.max(DESKTOP_CHAT_MIN_HEIGHT, Math.min(DESKTOP_CHAT_MAX_HEIGHT, viewportHeight - DESKTOP_CHAT_VIEWPORT_GAP))
  return Math.min(Math.max(value, DESKTOP_CHAT_MIN_HEIGHT), viewportCap)
}

function AvatarWithUnread({ friend, unreadCount }: { friend: Friend; unreadCount: number }) {
  return (
    <span className="relative shrink-0">
      <UserAvatar
        name={friend.displayName}
        email={friend.email}
        avatarText={friend.avatarText}
        avatarUrl={friend.avatarUrl}
        presenceStatus={friend.presenceStatus}
        size="sm"
      />
      {unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[#fa5151] px-1 text-center text-[10px] font-semibold leading-4 text-white shadow-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </span>
  )
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

  if (responses.some((response) => !response.ok)) throw new Error("Failed to load friends")

  const [friends, received, sent, summary] = await Promise.all(responses.map((response) => response.json()))
  return {
    friends: Array.isArray(friends) ? friends : [],
    received: Array.isArray(received) ? received : [],
    sent: Array.isArray(sent) ? sent : [],
    summaries: Array.isArray(summary.items) ? summary.items : [],
  }
}

export function FriendsClient({ userId, currentUser }: { userId: string; currentUser: ChatFriend }) {
  const labels = getLabels()
  const [view, setView] = useState<ViewMode>("friends")
  const [friends, setFriends] = useState<Friend[]>([])
  const [received, setReceived] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [summaries, setSummaries] = useState<Record<string, ChatSummary>>({})
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [requestNote, setRequestNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [requestSending, setRequestSending] = useState(false)
  const [unfriendTarget, setUnfriendTarget] = useState<Friend | null>(null)
  const [, startTransition] = useTransition()
  const friendCacheKey = userStorageKey(userId, "friends-cache", "overview")

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  )

  const refreshSummary = useCallback(async () => {
    try {
      const activeContext = getActiveChatContext()
      const params = new URLSearchParams()
      if (activeContext?.kind === "direct") params.set("activeFriendId", activeContext.id)
      const response = await fetch(params.size > 0 ? `/api/chats/summary?${params.toString()}` : "/api/chats/summary", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      const items = Array.isArray(data.items) ? data.items : []
      setSummaries(Object.fromEntries(items.map((item: ChatSummary) => [item.friendId, item])))
    } catch {
      // Summary is convenience-only. The chat thread itself is authoritative.
    }
  }, [])

  const chat = useChatSession(view === "chat" ? selectedFriendId : null, selectedFriend, refreshSummary, currentUser)

  const loadAll = useCallback(async ({ showLoading = true, useCache = true }: { showLoading?: boolean; useCache?: boolean } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const cached = useCache
        ? readUserStorage<FriendData>({
            kind: "session",
            key: friendCacheKey,
            userId,
            ttlMs: FRIEND_CACHE_TTL_MS,
          })
        : null
      if (cached && showLoading) {
        startTransition(() => {
          setFriends(cached.friends)
          setReceived(cached.received)
          setSent(cached.sent)
          setSummaries(Object.fromEntries(cached.summaries.map((item: ChatSummary) => [item.friendId, item])))
        })
        setLoading(false)
      }

      const data = await fetchFriendData()
      startTransition(() => {
        setFriends(data.friends)
        setReceived(data.received)
        setSent(data.sent)
        setSummaries(Object.fromEntries(data.summaries.map((item: ChatSummary) => [item.friendId, item])))
      })
      writeUserStorage({ kind: "session", key: friendCacheKey, userId, value: data })
    } catch {
      toast.error(labels.loadFailed)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [friendCacheKey, labels.loadFailed, startTransition, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAll])

  useEffect(() => {
    const refreshFriends = () => {
      if (document.visibilityState !== "visible") return
      removeUserStorage("session", friendCacheKey)
      void loadAll({ showLoading: false, useCache: false })
    }
    const refreshChatSummary = () => {
      void refreshSummary()
    }
    const interval = window.setInterval(refreshFriends, FRIEND_PRESENCE_REFRESH_MS)
    const onFocus = () => refreshFriends()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshFriends()
    }
    const unsubscribeActiveChat = subscribeActiveChatContext(() => {
      void refreshSummary()
    })

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("chat-unread-refresh", refreshChatSummary)
    window.addEventListener("presence-refresh", refreshFriends)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("chat-unread-refresh", refreshChatSummary)
      window.removeEventListener("presence-refresh", refreshFriends)
      unsubscribeActiveChat()
    }
  }, [friendCacheKey, loadAll, refreshSummary])

  function switchView(next: ViewMode) {
    setView(next)
    if (next === "chat" && !selectedFriendId && friends.length > 0) {
      setSelectedFriendId(friends[0].id)
    }
  }

  function openDesktopChat(friendId: string) {
    setSelectedFriendId(friendId)
    setView("chat")
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
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? labels.operationFailed)
      } else {
        toast.success(data.message ?? labels.requestSent)
        setEmail("")
        setRequestNote("")
        removeUserStorage("session", friendCacheKey)
        await loadAll({ useCache: false })
      }
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
      toast.success(action === "accept" ? labels.requestAccepted : labels.requestRejected)
      removeUserStorage("session", friendCacheKey)
      await loadAll({ useCache: false })
    } else {
      toast.error(labels.operationFailed)
    }
  }

  async function handleCancel(id: string) {
    const response = await fetch(`/api/friend-requests/${id}`, { method: "DELETE" })
    if (response.ok) {
      toast.success(labels.requestCancelled)
      removeUserStorage("session", friendCacheKey)
      await loadAll({ useCache: false })
    } else {
      toast.error(labels.operationFailed)
    }
  }

  async function handleUnfriend(friendshipId: string) {
    const response = await fetch(`/api/friend-requests/${friendshipId}`, { method: "DELETE" })
    if (response.ok) {
      toast.success(labels.unfriended)
      setUnfriendTarget(null)
      removeUserStorage("session", friendCacheKey)
      await loadAll({ useCache: false })
    } else {
      toast.error(labels.operationFailed)
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-[--color-text-muted]">{labels.loading}</div>
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-8">
        <button
          type="button"
          onClick={() => switchView("friends")}
          className={`flex flex-col items-center gap-1 text-sm transition-colors ${view === "friends" ? "text-[--color-link]" : "text-[--color-text-primary] hover:text-[--color-link]"}`}
        >
          <Users size={24} strokeWidth={1.8} />
          <span>{labels.friends}</span>
        </button>
        <button
          type="button"
          onClick={() => switchView("chat")}
          className="flex flex-col items-center gap-1 text-sm text-[--color-link] transition-colors hover:text-[--color-accent]"
        >
          <MessageCircle size={24} strokeWidth={1.8} />
          <span>{labels.chat}</span>
        </button>
      </div>

      {view === "friends" ? (
        <FriendsView
          friends={friends}
          received={received}
          sent={sent}
          summaries={summaries}
          email={email}
          requestNote={requestNote}
          requestSending={requestSending}
          onEmailChange={setEmail}
          onRequestNoteChange={setRequestNote}
          onSendRequest={handleSendRequest}
          onAccept={(id) => handleRespond(id, "accept")}
          onReject={(id) => handleRespond(id, "reject")}
          onCancel={handleCancel}
          onOpenChat={openDesktopChat}
          onUnfriend={setUnfriendTarget}
          labels={labels}
        />
      ) : (
        <ChatWorkspace
          friends={friends}
          summaries={summaries}
          selectedFriendId={selectedFriendId}
          selectedFriend={selectedFriend}
          onSelectFriend={setSelectedFriendId}
          chat={chat}
          userId={userId}
          currentUser={currentUser}
          labels={labels}
        />
      )}

      <Dialog open={Boolean(unfriendTarget)} onOpenChange={(open) => !open && setUnfriendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.removeFriendTitle}</DialogTitle>
            <DialogDescription>
              {labels.removeFriendBody} {unfriendTarget?.displayName || unfriendTarget?.email}。{labels.removeFriendHint}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnfriendTarget(null)}>
              {labels.cancel}
            </Button>
            <Button variant="destructive" onClick={() => unfriendTarget && handleUnfriend(unfriendTarget.friendshipId)}>
              {labels.confirmRemove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FriendsView({
  friends,
  received,
  sent,
  summaries,
  email,
  requestNote,
  requestSending,
  onEmailChange,
  onRequestNoteChange,
  onSendRequest,
  onAccept,
  onReject,
  onCancel,
  onOpenChat,
  onUnfriend,
  labels,
}: {
  friends: Friend[]
  received: FriendRequest[]
  sent: FriendRequest[]
  summaries: Record<string, ChatSummary>
  email: string
  requestNote: string
  requestSending: boolean
  onEmailChange: (value: string) => void
  onRequestNoteChange: (value: string) => void
  onSendRequest: () => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onCancel: (id: string) => void
  onOpenChat: (id: string) => void
  onUnfriend: (friend: Friend) => void
  labels: ReturnType<typeof getLabels>
}) {
  const onlineFriends = friends.filter((friend) => friend.presenceStatus === "online")
  const offlineFriends = friends.filter((friend) => friend.presenceStatus !== "online")

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
            <UserPlus size={14} /> {labels.addFriend}
          </h2>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void onSendRequest()
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder={labels.emailPlaceholder}
              className="rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-input] px-3 py-1.5 text-sm focus:border-[--color-accent] focus:outline-none"
            />
            <textarea
              value={requestNote}
              onChange={(event) => onRequestNoteChange(event.target.value)}
              maxLength={120}
              rows={2}
              placeholder={labels.notePlaceholder}
              className="resize-none rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-input] px-3 py-1.5 text-sm focus:border-[--color-accent] focus:outline-none"
            />
            <Button type="submit" disabled={requestSending || !email.trim() || !requestNote.trim()} className="h-9 gap-1.5">
              <UserPlus size={14} />
              {requestSending ? labels.sending : labels.sendRequest}
            </Button>
          </form>
        </section>

        {received.length > 0 ? (
          <RequestList
            title={`${labels.receivedRequests} (${received.length})`}
            requests={received}
            onAccept={onAccept}
            onReject={onReject}
            labels={labels}
          />
        ) : null}

        {sent.length > 0 ? <SentList requests={sent} onCancel={onCancel} labels={labels} /> : null}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
          <Users size={14} /> {labels.myFriends} ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">{labels.noFriends}</p>
        ) : (
          <div className="space-y-4">
            <FriendGroup
              title={labels.online}
              emptyText={labels.noOnlineFriends}
              friends={onlineFriends}
              summaries={summaries}
              onOpenChat={onOpenChat}
              onUnfriend={onUnfriend}
              labels={labels}
            />
            <FriendGroup
              title={labels.offline}
              emptyText={labels.noOfflineFriends}
              friends={offlineFriends}
              summaries={summaries}
              onOpenChat={onOpenChat}
              onUnfriend={onUnfriend}
              labels={labels}
            />
          </div>
        )}
      </section>
    </div>
  )
}

function FriendGroup({
  title,
  emptyText,
  friends,
  summaries,
  onOpenChat,
  onUnfriend,
  labels,
}: {
  title: string
  emptyText: string
  friends: Friend[]
  summaries: Record<string, ChatSummary>
  onOpenChat: (id: string) => void
  onUnfriend: (friend: Friend) => void
  labels: ReturnType<typeof getLabels>
}) {
  return (
    <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
      <div className="border-b border-[--color-border] px-3 py-2 text-xs font-semibold text-[--color-text-muted]">{title}</div>
      {friends.length === 0 ? (
        <p className="px-3 py-4 text-sm text-[--color-text-muted]">{emptyText}</p>
      ) : (
        friends.map((friend) => (
          <FriendRow
            key={friend.id}
            friend={friend}
            summary={summaries[friend.id]}
            onOpenChat={onOpenChat}
            onUnfriend={onUnfriend}
            labels={labels}
          />
        ))
      )}
    </div>
  )
}

function ChatWorkspace({
  friends,
  summaries,
  selectedFriendId,
  selectedFriend,
  onSelectFriend,
  chat,
  userId,
  currentUser,
  labels,
}: {
  friends: Friend[]
  summaries: Record<string, ChatSummary>
  selectedFriendId: string | null
  selectedFriend: Friend | null
  onSelectFriend: (id: string) => void
  chat: ReturnType<typeof useChatSession>
  userId: string
  currentUser: ChatFriend
  labels: ReturnType<typeof getLabels>
}) {
  const [desktopChatHeight, setDesktopChatHeight] = useState<number | null>(null)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const readPreferredHeight = () => {
      const saved = window.localStorage.getItem(DESKTOP_CHAT_HEIGHT_STORAGE_KEY)
      const parsed = saved ? Number.parseInt(saved, 10) : Number.NaN
      const fallback = window.innerHeight - 260
      const nextHeight = clampDesktopChatHeight(Number.isFinite(parsed) ? parsed : fallback, window.innerHeight)
      setDesktopChatHeight(nextHeight)
    }

    readPreferredHeight()

    const handleResize = () => {
      setDesktopChatHeight((current) => {
        const fallback = window.innerHeight - 260
        const nextHeight = clampDesktopChatHeight(current ?? fallback, window.innerHeight)
        window.localStorage.setItem(DESKTOP_CHAT_HEIGHT_STORAGE_KEY, String(nextHeight))
        return nextHeight
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || desktopChatHeight == null) return
    window.localStorage.setItem(DESKTOP_CHAT_HEIGHT_STORAGE_KEY, String(desktopChatHeight))
  }, [desktopChatHeight])

  const handleResizeStart = useCallback((clientY: number) => {
    if (typeof window === "undefined") return
    dragStateRef.current = {
      startY: clientY,
      startHeight: desktopChatHeight ?? clampDesktopChatHeight(window.innerHeight - 260, window.innerHeight),
    }
    document.body.style.userSelect = "none"
    document.body.style.cursor = "ns-resize"

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return
      const deltaY = moveEvent.clientY - dragState.startY
      const nextHeight = clampDesktopChatHeight(dragState.startHeight + deltaY, window.innerHeight)
      setDesktopChatHeight(nextHeight)
    }

    const finishResize = () => {
      dragStateRef.current = null
      document.body.style.removeProperty("user-select")
      document.body.style.removeProperty("cursor")
      window.removeEventListener("mousemove", handlePointerMove)
      window.removeEventListener("mouseup", finishResize)
    }

    window.addEventListener("mousemove", handlePointerMove)
    window.addEventListener("mouseup", finishResize)
  }, [desktopChatHeight])

  return (
    <div className="grid gap-6 lg:items-start lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="min-w-0">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
          <MessageCircle size={14} /> {labels.chat}
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">{labels.noChatFriends}</p>
        ) : (
          <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
            {friends.map((friend) => (
              <ConversationRow
                key={friend.id}
                friend={friend}
                summary={summaries[friend.id]}
                selected={selectedFriendId === friend.id}
                onSelect={onSelectFriend}
              />
            ))}
          </div>
        )}
      </section>

      <div className="hidden lg:-mt-[5.75rem] lg:block lg:self-start">
        <div
          className="flex flex-col"
          style={{
            height: desktopChatHeight != null ? `${desktopChatHeight}px` : undefined,
            minHeight: `${DESKTOP_CHAT_MIN_HEIGHT}px`,
            maxHeight: `min(${DESKTOP_CHAT_MAX_HEIGHT}px, calc(var(--app-viewport-height) - ${DESKTOP_CHAT_VIEWPORT_GAP}px))`,
          }}
        >
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
            className="min-h-0 flex-1"
            composerExtra={
              <SoulWingReplyButton
                chatType="direct"
                conversationId={selectedFriend?.id ?? ""}
                onInsertDraft={(text) => chat.setText(text)}
                onSend={undefined}
              />
            }
          />
          <button
            type="button"
            aria-label="Resize chat panel"
            onMouseDown={(event) => handleResizeStart(event.clientY)}
            className="mt-2 flex h-8 cursor-ns-resize select-none items-center justify-center rounded-full border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-muted] transition-colors hover:border-[--color-text-muted] hover:text-[--color-text-primary]"
          >
            <span className="flex items-center gap-2 text-[11px] font-medium">
              <span aria-hidden="true">↑</span>
              <span className="h-1 w-16 rounded-full bg-current/40" />
              <span aria-hidden="true">↓</span>
            </span>
          </button>
        </div>
      </div>

      <p className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 text-sm text-[--color-text-muted] lg:hidden">
        {labels.mobileHint}
      </p>
    </div>
  )
}

function FriendRow({
  friend,
  summary,
  onOpenChat,
  onUnfriend,
  labels,
}: {
  friend: Friend
  summary?: ChatSummary
  onOpenChat: (id: string) => void
  onUnfriend: (friend: Friend) => void
  labels: ReturnType<typeof getLabels>
}) {
  const unreadCount = summary?.unreadCount ?? 0

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[--color-border] p-3 last:border-b-0">
      <Link href={`/u/${friend.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:no-underline">
        <AvatarWithUnread friend={friend} unreadCount={unreadCount} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{friend.displayName || friend.email}</span>
          <span className="block truncate text-xs text-[--color-text-muted]">{friend.email}</span>
          <span className="block text-xs text-[--color-text-muted]">{presenceLabel(friend.presenceStatus)}</span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/friends/chat/${friend.id}`} className="inline-flex h-8 items-center gap-1.5 px-1 text-xs font-medium text-[--color-link] hover:text-[--color-accent] hover:no-underline lg:hidden">
          {labels.openChat}
        </Link>
        <button onClick={() => onOpenChat(friend.id)} className="hidden h-8 items-center gap-1.5 px-1 text-xs font-medium text-[--color-link] transition-colors hover:text-[--color-accent] lg:inline-flex">
          {labels.openChat}
        </button>
        <button onClick={() => onUnfriend(friend)} className="inline-flex items-center gap-1 text-xs text-[--color-text-muted] transition-colors hover:text-red-500">
          <UserMinus size={12} /> {labels.unfriend}
        </button>
      </div>
    </div>
  )
}

function ConversationRow({
  friend,
  summary,
  selected,
  onSelect,
}: {
  friend: Friend
  summary?: ChatSummary
  selected: boolean
  onSelect: (id: string) => void
}) {
  const unreadCount = summary?.unreadCount ?? 0
  const time = formatChatTime(summary?.latest?.createdAt)
  const content = (
    <>
      <AvatarWithUnread friend={friend} unreadCount={unreadCount} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-sm font-medium">{friend.displayName || friend.email}</span>
          {time ? <span className="shrink-0 font-mono text-[11px] text-[--color-text-muted]">{time}</span> : null}
        </span>
        <span className="block truncate text-xs text-[--color-text-muted]">{messagePreview(summary)}</span>
      </span>
    </>
  )

  return (
    <div className={`border-b border-[--color-border] last:border-b-0 ${selected ? "bg-[--color-bg-hover]" : ""}`}>
      <Link href={`/friends/chat/${friend.id}`} className="flex min-w-0 items-center gap-3 p-3 hover:bg-[--color-bg-hover] hover:no-underline lg:hidden">
        {content}
      </Link>
      <button onClick={() => onSelect(friend.id)} className="hidden w-full min-w-0 items-center gap-3 p-3 text-left hover:bg-[--color-bg-hover] lg:flex">
        {content}
      </button>
    </div>
  )
}

function SentList({
  requests,
  onCancel,
  labels,
}: {
  requests: FriendRequest[]
  onCancel: (id: string) => void
  labels: ReturnType<typeof getLabels>
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
        <Clock size={14} /> {labels.sentRequests} ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between border-b border-[--color-border] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{request.to.displayName || request.to.email}</p>
              <p className="truncate text-xs text-[--color-text-muted]">{request.to.email}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[--color-text-secondary]">
                {labels.note}: {request.note}
              </p>
            </div>
            <button onClick={() => onCancel(request.id)} className="text-xs text-[--color-text-muted] transition-colors hover:text-[--color-text-primary]">
              {labels.cancel}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function RequestList({
  title,
  requests,
  onAccept,
  onReject,
  labels,
}: {
  title: string
  requests: FriendRequest[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  labels: ReturnType<typeof getLabels>
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
        <Clock size={14} /> {title}
      </h2>
      <div className="space-y-2">
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 border-b border-[--color-border] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{request.from.displayName || request.from.email}</p>
              <p className="truncate text-xs text-[--color-text-muted]">{request.from.email}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[--color-text-secondary]">
                {labels.note}: {request.note}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => onAccept(request.id)} className="inline-flex items-center gap-1 rounded-[--radius-sm] bg-[#1A1A1A] px-3 py-1 text-xs text-white hover:bg-[#333333]">
                <Check size={11} /> {labels.accept}
              </button>
              <button onClick={() => onReject(request.id)} className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-[--color-border] px-3 py-1 text-xs text-[--color-text-secondary] hover:bg-[--color-bg-hover]">
                <X size={11} /> {labels.reject}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

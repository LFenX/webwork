"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Clock, MessageCircle, UserMinus, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChatPanel, type ChatFriend, type ChatSummary, messagePreview, presenceLabel, useChatSession } from "@/components/friend-chat"
import { UserAvatar } from "@/components/user-avatar"

interface Friend extends ChatFriend {
  bio: string
  presenceStatus: "online" | "away" | "offline"
  friendshipId: string
}

interface FriendRequest {
  id: string
  from: { id: string; email: string; displayName: string }
  to: { id: string; email: string; displayName: string }
  status: string
  createdAt: string
}

type ViewMode = "friends" | "chat"

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
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${time}`
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
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[#fa5151] px-1 text-center text-[10px] font-semibold leading-4 text-white shadow-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </span>
  )
}

async function fetchFriendData() {
  const responses = await Promise.all([
    fetch("/api/friends", { cache: "no-store" }),
    fetch("/api/friend-requests?direction=received", { cache: "no-store" }),
    fetch("/api/friend-requests?direction=sent", { cache: "no-store" }),
    fetch("/api/chats/summary", { cache: "no-store" }),
  ])
  if (responses.some((res) => !res.ok)) throw new Error("Failed to load friends")

  const [friends, received, sent, summary] = await Promise.all(responses.map((res) => res.json()))
  return {
    friends: Array.isArray(friends) ? friends : [],
    received: Array.isArray(received) ? received : [],
    sent: Array.isArray(sent) ? sent : [],
    summaries: Array.isArray(summary.items) ? summary.items : [],
  }
}

export function FriendsClient() {
  const [view, setView] = useState<ViewMode>("friends")
  const [friends, setFriends] = useState<Friend[]>([])
  const [received, setReceived] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [summaries, setSummaries] = useState<Record<string, ChatSummary>>({})
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [requestSending, setRequestSending] = useState(false)
  const [unfriendTarget, setUnfriendTarget] = useState<Friend | null>(null)
  const [, startTransition] = useTransition()

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  )

  const refreshSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/chats/summary", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []
      setSummaries(Object.fromEntries(items.map((item: ChatSummary) => [item.friendId, item])))
    } catch {
      // Summary is a badge/preview convenience; the conversation itself is authoritative.
    }
  }, [])

  const chat = useChatSession(view === "chat" ? selectedFriendId : null, selectedFriend, refreshSummary)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFriendData()
      startTransition(() => {
        setFriends(data.friends)
        setReceived(data.received)
        setSent(data.sent)
        setSummaries(Object.fromEntries(data.summaries.map((item: ChatSummary) => [item.friendId, item])))
      })
    } catch {
      toast.error("加载好友数据失败")
    } finally {
      setLoading(false)
    }
  }, [startTransition])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAll])

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
    if (!email.trim()) return
    setRequestSending(true)
    try {
      const res = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "发送失败")
      } else {
        toast.success(data.message ?? "好友请求已发送")
        setEmail("")
        await loadAll()
      }
    } finally {
      setRequestSending(false)
    }
  }

  async function handleRespond(id: string, action: "accept" | "reject") {
    const res = await fetch(`/api/friend-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      toast.success(action === "accept" ? "已接受" : "已拒绝")
      await loadAll()
    } else {
      toast.error("操作失败")
    }
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/friend-requests/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("已取消")
      await loadAll()
    } else {
      toast.error("操作失败")
    }
  }

  async function handleUnfriend(friendshipId: string) {
    const res = await fetch(`/api/friend-requests/${friendshipId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("已解除好友关系")
      setUnfriendTarget(null)
      await loadAll()
    } else {
      toast.error("操作失败")
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-[--color-text-muted]">加载中...</div>
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
          <span>好友</span>
        </button>
        <button
          type="button"
          onClick={() => switchView("chat")}
          className={`flex flex-col items-center gap-1 text-sm transition-colors ${view === "chat" ? "text-[--color-link]" : "text-[--color-text-primary] hover:text-[--color-link]"}`}
        >
          <MessageCircle size={24} strokeWidth={1.8} />
          <span>聊天</span>
        </button>
      </div>

      {view === "friends" ? (
        <FriendsView
          friends={friends}
          received={received}
          sent={sent}
          summaries={summaries}
          email={email}
          requestSending={requestSending}
          onEmailChange={setEmail}
          onSendRequest={handleSendRequest}
          onAccept={(id) => handleRespond(id, "accept")}
          onReject={(id) => handleRespond(id, "reject")}
          onCancel={handleCancel}
          onOpenChat={openDesktopChat}
          onUnfriend={setUnfriendTarget}
        />
      ) : (
        <ChatWorkspace
          friends={friends}
          summaries={summaries}
          selectedFriendId={selectedFriendId}
          selectedFriend={selectedFriend}
          onSelectFriend={setSelectedFriendId}
          chat={chat}
        />
      )}

      <Dialog open={Boolean(unfriendTarget)} onOpenChange={(open) => !open && setUnfriendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认解除好友？</DialogTitle>
            <DialogDescription>
              将解除与 {unfriendTarget?.displayName || unfriendTarget?.email} 的好友关系。历史聊天记录会保留，但解除后不能继续聊天。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnfriendTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => unfriendTarget && handleUnfriend(unfriendTarget.friendshipId)}>
              确认解除
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
  requestSending,
  onEmailChange,
  onSendRequest,
  onAccept,
  onReject,
  onCancel,
  onOpenChat,
  onUnfriend,
}: {
  friends: Friend[]
  received: FriendRequest[]
  sent: FriendRequest[]
  summaries: Record<string, ChatSummary>
  email: string
  requestSending: boolean
  onEmailChange: (value: string) => void
  onSendRequest: () => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onCancel: (id: string) => void
  onOpenChat: (id: string) => void
  onUnfriend: (friend: Friend) => void
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
            <UserPlus size={14} /> 添加好友
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
              placeholder="输入对方邮箱"
              className="rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-input] px-3 py-1.5 text-sm focus:border-[--color-accent] focus:outline-none"
            />
            <Button type="submit" disabled={requestSending || !email.trim()} className="h-9 gap-1.5">
              <UserPlus size={14} />
              {requestSending ? "发送中..." : "发送好友请求"}
            </Button>
          </form>
        </section>
        {received.length > 0 && <RequestList title={`收到的好友请求 (${received.length})`} requests={received} onAccept={onAccept} onReject={onReject} />}
        {sent.length > 0 && <SentList requests={sent} onCancel={onCancel} />}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
          <Users size={14} /> 我的好友 ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">还没有好友，通过左侧搜索框添加。</p>
        ) : (
          <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
            {friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                summary={summaries[friend.id]}
                onOpenChat={onOpenChat}
                onUnfriend={onUnfriend}
              />
            ))}
          </div>
        )}
      </section>
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
}: {
  friends: Friend[]
  summaries: Record<string, ChatSummary>
  selectedFriendId: string | null
  selectedFriend: Friend | null
  onSelectFriend: (id: string) => void
  chat: ReturnType<typeof useChatSession>
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="min-w-0">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
          <MessageCircle size={14} /> 聊天
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">还没有可以聊天的好友。</p>
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
      <div className="hidden lg:block">
        <ChatPanel
          friend={selectedFriend}
          messages={chat.messages}
          loading={chat.loading}
          sending={chat.sending}
          text={chat.text}
          files={chat.files}
          sendOriginal={chat.sendOriginal}
          onTextChange={chat.setText}
          onFilesChange={chat.setFiles}
          onSendOriginalChange={chat.setSendOriginal}
          onSend={chat.sendMessage}
          onReload={chat.loadMessages}
          onRetryMessage={chat.retryMessage}
          onDiscardMessage={chat.discardMessage}
          className="h-[calc(var(--app-viewport-height)-13rem)] min-h-[560px]"
        />
      </div>
      <p className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 text-sm text-[--color-text-muted] lg:hidden">
        在手机上点击上方好友进入独立聊天页面。
      </p>
    </div>
  )
}

function FriendRow({
  friend,
  summary,
  onOpenChat,
  onUnfriend,
}: {
  friend: Friend
  summary?: ChatSummary
  onOpenChat: (id: string) => void
  onUnfriend: (friend: Friend) => void
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
          聊天
        </Link>
        <button onClick={() => onOpenChat(friend.id)} className="hidden h-8 items-center gap-1.5 px-1 text-xs font-medium text-[--color-link] transition-colors hover:text-[--color-accent] lg:inline-flex">
          聊天
        </button>
        <button onClick={() => onUnfriend(friend)} className="inline-flex items-center gap-1 text-xs text-[--color-text-muted] transition-colors hover:text-red-500">
          <UserMinus size={12} /> 解除
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
          {time && <span className="shrink-0 font-mono text-[11px] text-[--color-text-muted]">{time}</span>}
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

function SentList({ requests, onCancel }: { requests: FriendRequest[]; onCancel: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
        <Clock size={14} /> 已发出的请求 ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between border-b border-[--color-border] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{req.to.displayName || req.to.email}</p>
              <p className="truncate text-xs text-[--color-text-muted]">{req.to.email}</p>
            </div>
            <button onClick={() => onCancel(req.id)} className="text-xs text-[--color-text-muted] transition-colors hover:text-[--color-text-primary]">
              取消
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
}: {
  title: string
  requests: FriendRequest[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[--color-text-secondary]">
        <Clock size={14} /> {title}
      </h2>
      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-3 border-b border-[--color-border] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{req.from.displayName || req.from.email}</p>
              <p className="truncate text-xs text-[--color-text-muted]">{req.from.email}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => onAccept(req.id)} className="inline-flex items-center gap-1 rounded-[--radius-sm] bg-[#1A1A1A] px-3 py-1 text-xs text-white hover:bg-[#333333]">
                <Check size={11} /> 接受
              </button>
              <button onClick={() => onReject(req.id)} className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-[--color-border] px-3 py-1 text-xs text-[--color-text-secondary] hover:bg-[--color-bg-hover]">
                <X size={11} /> 拒绝
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

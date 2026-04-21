"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { UserPlus, UserMinus, Check, X, Clock, Users } from "lucide-react"

interface Friend {
  id: string
  email: string
  displayName: string
  bio: string
  friendshipId: string
}

interface FriendRequest {
  id: string
  from: { id: string; email: string; displayName: string }
  to: { id: string; email: string; displayName: string }
  status: string
  createdAt: string
}

export function FriendsClient() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [received, setReceived] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [fr, recv, snt] = await Promise.all([
        fetch("/api/friends", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/friend-requests?direction=received", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/friend-requests?direction=sent", { cache: "no-store" }).then((r) => r.json()),
      ])
      setFriends(Array.isArray(fr) ? fr : [])
      setReceived(Array.isArray(recv) ? recv : [])
      setSent(Array.isArray(snt) ? snt : [])
    } catch {
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleSendRequest() {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
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
      setSending(false)
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
      await loadAll()
    } else {
      toast.error("操作失败")
    }
  }

  if (loading) {
    return <div className="text-sm text-[--color-text-muted] py-10 text-center">加载中…</div>
  }

  return (
    <div className="space-y-10">
      {/* Send request */}
      <section>
        <h2 className="text-sm font-semibold text-[--color-text-secondary] mb-3 flex items-center gap-1.5">
          <UserPlus size={14} /> 添加好友
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
            placeholder="输入对方邮箱"
            className="flex-1 px-3 py-1.5 text-sm border border-[--color-border] rounded-[--radius-sm] bg-[--color-bg-input] focus:outline-none focus:border-[--color-accent]"
          />
          <button
            onClick={handleSendRequest}
            disabled={sending || !email.trim()}
            className="px-4 py-1.5 text-sm bg-[--color-text-primary] text-white rounded-[--radius-sm] disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {sending ? "发送中…" : "发送请求"}
          </button>
        </div>
      </section>

      {/* Received requests */}
      {received.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[--color-text-secondary] mb-3 flex items-center gap-1.5">
            <Clock size={14} /> 收到的好友请求 ({received.length})
          </h2>
          <div className="space-y-2">
            {received.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3 border-b border-[--color-border]">
                <div>
                  <p className="text-sm font-medium">{req.from.displayName || req.from.email}</p>
                  <p className="text-xs text-[--color-text-muted]">{req.from.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(req.id, "accept")}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-[--color-accent] text-white rounded-[--radius-sm] hover:opacity-90"
                  >
                    <Check size={11} /> 接受
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, "reject")}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs border border-[--color-border] text-[--color-text-secondary] rounded-[--radius-sm] hover:bg-[--color-bg-hover]"
                  >
                    <X size={11} /> 拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sent requests */}
      {sent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[--color-text-secondary] mb-3 flex items-center gap-1.5">
            <Clock size={14} /> 已发送的请求 ({sent.length})
          </h2>
          <div className="space-y-2">
            {sent.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3 border-b border-[--color-border]">
                <div>
                  <p className="text-sm font-medium">{req.to.displayName || req.to.email}</p>
                  <p className="text-xs text-[--color-text-muted]">{req.to.email}</p>
                </div>
                <button
                  onClick={() => handleCancel(req.id)}
                  className="text-xs text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
                >
                  取消
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <h2 className="text-sm font-semibold text-[--color-text-secondary] mb-3 flex items-center gap-1.5">
          <Users size={14} /> 我的好友 ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">还没有好友，通过上方搜索框添加。</p>
        ) : (
          <div className="space-y-0">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between py-3 border-b border-[--color-border]">
                <Link href={`/u/${friend.id}`} className="hover:no-underline group">
                  <p className="text-sm font-medium group-hover:text-[--color-accent] transition-colors">
                    {friend.displayName || friend.email}
                  </p>
                  <p className="text-xs text-[--color-text-muted]">{friend.email}</p>
                  {friend.bio && (
                    <p className="text-xs text-[--color-text-muted] mt-0.5 truncate max-w-[300px]">{friend.bio}</p>
                  )}
                </Link>
                <button
                  onClick={() => handleUnfriend(friend.friendshipId)}
                  className="inline-flex items-center gap-1 text-xs text-[--color-text-muted] hover:text-red-500 transition-colors"
                >
                  <UserMinus size={12} /> 解除好友
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

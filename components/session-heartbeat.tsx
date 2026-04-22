"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type HeartbeatResponse = {
  status: "online" | "away" | "offline" | "replaced" | "expired" | string
  message?: string
}

const ACTIVITY_THROTTLE_MS = 30_000

export function SessionHeartbeat() {
  const [message, setMessage] = useState("")
  const [open, setOpen] = useState(false)
  const lastActivityPing = useRef(0)
  const redirecting = useRef(false)
  const replacementNotified = useRef(false)

  const goLogin = useCallback(() => {
    if (redirecting.current) return
    redirecting.current = true
    window.location.replace("/login")
  }, [])

  const ping = useCallback(async (touch = false, foreground = document.visibilityState === "visible") => {
    if (redirecting.current || replacementNotified.current) return
    try {
      const res = await fetch("/api/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touch, foreground }),
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as HeartbeatResponse
      if (foreground && (data.status === "online" || data.status === "away")) {
        window.dispatchEvent(new CustomEvent("session-presence", { detail: data.status }))
      }
      if (data.status === "replaced") {
        replacementNotified.current = true
        setMessage(data.message || "你的账号已在另一台设备登录。如果不是你本人，请及时修改密码。")
        setOpen(true)
        window.setTimeout(goLogin, 12_000)
      } else if (!replacementNotified.current && (data.status === "expired" || data.status === "offline")) {
        goLogin()
      }
    } catch {
      // Ignore transient network errors; the next heartbeat will retry.
    }
  }, [goLogin])

  useEffect(() => {
    const initial = window.setTimeout(() => void ping(true, document.visibilityState === "visible"), 0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void ping(false, true)
    }, 60_000)
    const onFocus = () => void ping(true, true)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void ping(true, true)
      else void ping(false, false)
    }
    const onActivity = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastActivityPing.current < ACTIVITY_THROTTLE_MS) return
      lastActivityPing.current = now
      void ping(true, true)
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pointerdown", onActivity, { passive: true })
    window.addEventListener("keydown", onActivity)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(initial)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pointerdown", onActivity)
      window.removeEventListener("keydown", onActivity)
    }
  }, [ping])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>账号已在其他设备登录</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={goLogin}>重新登录</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

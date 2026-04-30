"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { readUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import type { RecentActivityGroup, RecentActivityItem } from "@/components/recent-activity-panel"

const RECENT_ACTIVITY_SEEN_STORAGE_NAMESPACE = "recent-activity-seen"
const RECENT_ACTIVITY_SEEN_STORAGE_ID = "home"
const RECENT_ACTIVITY_SEEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

function recentActivitySeenStorageKey(userId: string) {
  return userStorageKey(userId, RECENT_ACTIVITY_SEEN_STORAGE_NAMESPACE, RECENT_ACTIVITY_SEEN_STORAGE_ID)
}

function isSameSearchValue(itemUrl: URL, currentUrl: URL, key: string) {
  const expected = itemUrl.searchParams.get(key)
  return expected !== null && currentUrl.searchParams.get(key) === expected
}

function isRelatedActivityView(item: RecentActivityItem, currentUrl: URL) {
  const itemUrl = new URL(item.href, currentUrl.origin)
  if (itemUrl.pathname !== currentUrl.pathname) return false

  if (itemUrl.searchParams.has("focus")) return isSameSearchValue(itemUrl, currentUrl, "focus")
  if (itemUrl.searchParams.has("discussion")) {
    return isSameSearchValue(itemUrl, currentUrl, "channel") && isSameSearchValue(itemUrl, currentUrl, "discussion")
  }

  if (itemUrl.pathname === "/stickers/community") return true
  if (/^\/u\/[^/]+\/(?:jobs|resume)$/.test(itemUrl.pathname)) return true
  if (/^\/u\/[^/]+\/(?:blog|daily|reflections|notes)\/[^/]+$/.test(itemUrl.pathname)) return true

  return itemUrl.search === currentUrl.search
}

export function RecentActivityReadTracker({ userId }: { userId: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || pathname === "/") return
    const currentUrl = new URL(`${pathname}?${searchParams.toString()}`, window.location.origin)

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const res = await fetch("/api/home/recent-activity", { cache: "no-store" }).catch(() => null)
      if (!res?.ok || cancelled) return
      const data = await res.json().catch(() => ({}))
      const groups = Array.isArray(data.groups) ? data.groups as RecentActivityGroup[] : []
      const matchedIds = groups
        .filter((group) => group.key !== "chat")
        .flatMap((group) => group.items)
        .filter((item) => isRelatedActivityView(item, currentUrl))
        .map((item) => item.id)

      if (matchedIds.length === 0 || cancelled) return

      void fetch("/api/home/recent-activity/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityIds: matchedIds }),
      }).catch(() => null)

      const key = recentActivitySeenStorageKey(userId)
      const current = readUserStorage<Record<string, number>>({
        kind: "local",
        key,
        userId,
        ttlMs: RECENT_ACTIVITY_SEEN_TTL_MS,
      }) ?? {}
      const next = { ...current }
      matchedIds.forEach((id) => {
        next[id] = 1
      })
      writeUserStorage({ kind: "local", key, userId, value: next })
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pathname, searchParams, userId])

  return null
}

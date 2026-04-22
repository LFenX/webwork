"use client"

import { useState } from "react"

type UserAvatarProps = {
  name?: string | null
  email?: string | null
  avatarText?: string | null
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  presenceStatus?: "online" | "away" | "offline"
  className?: string
}

const SIZE_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-xl",
  xl: "h-24 w-24 text-2xl",
}

function fallbackText(name?: string | null, email?: string | null, avatarText?: string | null) {
  const source = avatarText || name || email || "我"
  return Array.from(source.trim()).slice(0, 2).join("").toUpperCase() || "我"
}

export function UserAvatar({ name, email, avatarText, avatarUrl, size = "md", presenceStatus, className = "" }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${SIZE_CLASS[size]} overflow-hidden rounded-full border border-[--color-border-strong] bg-[--color-bg-hover] ${presenceStatus === "offline" ? "grayscale" : presenceStatus === "away" ? "opacity-70" : ""}`}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl || undefined}
            alt={name || email || "头像"}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(avatarUrl ?? null)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-semibold text-[--color-text-primary]">
            {fallbackText(name, email, avatarText)}
          </div>
        )}
      </div>
      {presenceStatus && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[--color-bg-primary] ${
            presenceStatus === "online" ? "bg-emerald-500" : presenceStatus === "away" ? "bg-amber-400" : "bg-gray-400"
          }`}
          aria-label={presenceStatus === "online" ? "在线" : presenceStatus === "away" ? "离开" : "下线"}
          title={presenceStatus === "online" ? "在线" : presenceStatus === "away" ? "离开" : "下线"}
        />
      )}
    </div>
  )
}

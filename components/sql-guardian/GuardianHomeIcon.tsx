"use client"

import { cn } from "@/lib/utils"
import { mockGuardianProfile } from "@/lib/sql-guardian/mock-profile"
import { wakeGuardian } from "@/lib/sql-guardian/client-events"

type GuardianHomeIconProps = {
  className?: string
  compact?: boolean
}

export function GuardianHomeIcon({ className, compact = false }: GuardianHomeIconProps) {
  return (
    <button
      type="button"
      onClick={() => wakeGuardian("sql-lab-home")}
      className={cn(
        "group relative inline-flex shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 text-cyan-950 shadow-[0_6px_18px_rgba(8,145,178,0.12)] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        compact ? "size-8" : "size-9",
        className
      )}
      aria-label="唤醒 SQL Guardian 角色之家"
      title="SQL Guardian 角色之家"
    >
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true" className={compact ? "size-7" : "size-8"}>
        <path d="M8 29c4-10 11-16 18-16s12 6 14 16c-5 5-10 8-16 8S13 34 8 29Z" fill="#A5F3FC" />
        <path d="M13 28c4 4 8 6 12 6s8-2 12-6" fill="none" stroke="#0E7490" strokeLinecap="round" strokeWidth="2" />
        <path d="M18 17 25 7l9 19-9-4-7 5Z" fill="#FDE68A" stroke="#B45309" strokeWidth="1.5" />
        <path d="M24.5 9v26" stroke="#155E75" strokeLinecap="round" strokeWidth="2" />
        <rect x="18" y="26" width="13" height="8" rx="2" fill="#ECFEFF" stroke="#0891B2" strokeWidth="1.5" />
        <path d="M20 30h9" stroke="#0E7490" strokeLinecap="round" strokeWidth="1.5" />
        <circle cx="37" cy="14" r="3" fill="#22D3EE" className="motion-safe:group-hover:animate-pulse" />
      </svg>
      <span className="absolute -right-1 -top-1 rounded-full border border-white bg-cyan-700 px-1 font-mono text-[8px] leading-4 text-white">
        {mockGuardianProfile.level}
      </span>
    </button>
  )
}

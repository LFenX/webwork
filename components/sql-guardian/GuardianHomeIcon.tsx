"use client"

import { wakeGuardian } from "@/lib/sql-guardian/client-events"
import { getGuardianVisualForm } from "@/lib/sql-guardian/visual-forms"
import { cn } from "@/lib/utils"

type GuardianHomeIconProps = {
  className?: string
  compact?: boolean
  formStage?: string | null
  level?: number
}

export function GuardianHomeIcon({ className, compact = false, formStage, level }: GuardianHomeIconProps) {
  const visualForm = getGuardianVisualForm({ formStage, level })
  const isHarbor = visualForm.homeVariant === "harbor"
  const isLighthouse = visualForm.homeVariant === "lighthouse"
  const isStarPort = visualForm.homeVariant === "star-port"

  return (
    <button
      type="button"
      onClick={() => wakeGuardian("home-clicked")}
      className={cn(
        "group relative inline-flex shrink-0 items-center justify-center rounded-md border bg-cyan-50 text-cyan-950 shadow-[0_4px_12px_rgba(8,145,178,0.1)] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        visualForm.borderClassName,
        compact ? "size-8" : "size-9",
        className
      )}
      aria-label="Wake SQL Guardian from the data home"
      title={`SQL Guardian data home: ${visualForm.label}`}
      data-sql-guardian-home
      data-home-variant={visualForm.homeVariant}
    >
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true" className={compact ? "size-7" : "size-8"}>
        {isStarPort ? <circle cx="24" cy="24" r="18" fill="#D1FAE5" opacity="0.62" /> : null}
        {isLighthouse || isStarPort ? (
          <path d="M29 9c8 5 11 12 12 22-5-5-11-8-18-8 1-6 3-10 6-14Z" fill="#BAE6FD" opacity="0.55" />
        ) : null}
        <path d="M8 29c4-10 11-16 18-16s12 6 14 16c-5 5-10 8-16 8S13 34 8 29Z" fill={isStarPort ? "#A7F3D0" : "#A5F3FC"} />
        <path d="M13 28c4 4 8 6 12 6s8-2 12-6" fill="none" stroke="#0E7490" strokeLinecap="round" strokeWidth="2" />
        <path d="M18 17 25 7l9 19-9-4-7 5Z" fill={isLighthouse || isStarPort ? "#FDE68A" : "#CFFAFE"} stroke="#B45309" strokeWidth="1.5" />
        <path d="M24.5 9v26" stroke="#155E75" strokeLinecap="round" strokeWidth="2" />
        {isHarbor || isLighthouse || isStarPort ? (
          <path d="M11 36h27M15 33h6M29 33h6" stroke="#0E7490" strokeLinecap="round" strokeWidth="1.5" opacity="0.78" />
        ) : null}
        <rect x="18" y="26" width="13" height="8" rx="2" fill="#ECFEFF" stroke="#0891B2" strokeWidth="1.5" />
        <path d="M20 30h9" stroke="#0E7490" strokeLinecap="round" strokeWidth="1.5" />
        {isStarPort ? (
          <g fill="#059669">
            <circle cx="13" cy="14" r="1.4" />
            <circle cx="36" cy="12" r="1.2" />
            <circle cx="39" cy="34" r="1.1" />
          </g>
        ) : null}
        <circle cx="37" cy="14" r="3" fill={isStarPort ? "#34D399" : "#22D3EE"} className="motion-safe:group-hover:animate-pulse" />
      </svg>
      <span className="pointer-events-none absolute right-0 top-[calc(100%+0.35rem)] hidden whitespace-nowrap rounded-md border border-cyan-100 bg-white px-2 py-1 font-mono text-[10px] text-cyan-900 shadow-sm group-hover:block">
        Data home
      </span>
    </button>
  )
}

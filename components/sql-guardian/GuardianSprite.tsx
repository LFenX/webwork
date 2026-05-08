"use client"

import { cn } from "@/lib/utils"
import type { GuardianProfile, GuardianVisualState } from "@/lib/sql-guardian/types"

type GuardianSpriteProps = {
  profile: GuardianProfile
  visualState: GuardianVisualState
  reducedMotion?: boolean
  size?: "sm" | "md"
  onClick?: () => void
  className?: string
}

const STATE_LABEL: Record<GuardianVisualState, string> = {
  idle: "idle",
  talking: "talking",
  thinking: "thinking",
  sleeping: "sleeping",
  hidden: "hidden",
}

export function GuardianSprite({
  profile,
  visualState,
  reducedMotion = false,
  size = "md",
  onClick,
  className,
}: GuardianSpriteProps) {
  if (visualState === "hidden") return null

  const isCompact = size === "sm"
  const isThinking = visualState === "thinking"
  const isTalking = visualState === "talking"
  const isSleeping = visualState === "sleeping"
  const animationClass = reducedMotion
    ? ""
    : isTalking
      ? "motion-safe:animate-pulse"
      : isThinking
        ? ""
        : isSleeping
          ? ""
          : "motion-safe:animate-pulse"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative isolate flex items-center justify-center rounded-full border border-[--color-border] bg-[--color-bg-surface] shadow-[0_16px_40px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isCompact ? "size-12" : "size-20",
        animationClass,
        className
      )}
      aria-label={`SQL Guardian ${profile.name}, ${STATE_LABEL[visualState]}`}
      title={isSleeping ? "唤醒 SQL Guardian" : "和 SQL Guardian 说话"}
    >
      <span
        className={cn(
          "absolute rounded-full bg-cyan-300/20 blur-md",
          isCompact ? "inset-1" : "inset-2",
          isThinking && !reducedMotion ? "animate-pulse" : ""
        )}
      />
      <svg
        viewBox="0 0 96 96"
        role="img"
        aria-hidden="true"
        className={cn("relative drop-shadow-sm", isCompact ? "size-10" : "size-[72px]")}
      >
        <defs>
          <linearGradient id="guardian-shell" x1="20" x2="76" y1="18" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E0F7FA" />
            <stop offset="0.52" stopColor="#67E8F9" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="guardian-sail" x1="34" x2="70" y1="10" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF7ED" />
            <stop offset="1" stopColor="#FBBF24" />
          </linearGradient>
        </defs>

        <path d="M21 63c3-20 17-34 29-34s25 14 28 34c-8 10-18 15-29 15S29 73 21 63Z" fill="url(#guardian-shell)" />
        <path d="M28 63c7 6 14 9 21 9s14-3 21-9" fill="none" stroke="#0F172A" strokeOpacity="0.28" strokeWidth="2" />
        <path d="M36 31 50 13l17 33-17-6-14 8Z" fill="url(#guardian-sail)" stroke="#92400E" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M49 15v57" stroke="#134E4A" strokeLinecap="round" strokeWidth="2.5" />
        <path d="M31 54c6-5 12-8 18-8s13 3 19 8" fill="none" stroke="#ECFEFF" strokeLinecap="round" strokeWidth="4" />
        <circle cx="38" cy="58" r="4" fill="#0F172A" />
        <circle cx="61" cy="58" r="4" fill="#0F172A" />
        <circle cx="39.5" cy="56.5" r="1.2" fill="#E0F2FE" />
        <circle cx="62.5" cy="56.5" r="1.2" fill="#E0F2FE" />
        <path
          d={isTalking ? "M42 68c5 4 10 4 15 0" : isSleeping ? "M42 68c4 1 9 1 14 0" : "M43 68c4 3 9 3 13 0"}
          fill="none"
          stroke="#0F172A"
          strokeLinecap="round"
          strokeWidth="2.5"
        />

        <g className={cn(isThinking && !reducedMotion ? "origin-center animate-spin" : "")}>
          <circle cx="72" cy="29" r="9" fill="#F8FAFC" stroke="#0E7490" strokeWidth="2" />
          <path d="m72 23 2.5 6.5L68 33l2.5-6.5Z" fill="#0891B2" />
        </g>

        <g opacity={isSleeping ? 1 : 0} className={cn(!reducedMotion && isSleeping ? "animate-pulse" : "")}>
          <text x="70" y="20" fill="#0E7490" fontFamily="monospace" fontSize="10" fontWeight="700">
            Zz
          </text>
        </g>
        <g opacity={isThinking ? 1 : 0.45}>
          <path d="M23 34h9M18 42h13M22 50h7" stroke="#0E7490" strokeLinecap="round" strokeWidth="2" />
        </g>
      </svg>
      <span className="sr-only">Lv.{profile.level}</span>
    </button>
  )
}

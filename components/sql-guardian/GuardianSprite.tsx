"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"
import type { GuardianProfile, GuardianVisualState } from "@/lib/sql-guardian/types"
import { getGuardianMoodVisual, getGuardianVisualForm, type GuardianAura } from "@/lib/sql-guardian/visual-forms"
import styles from "@/components/sql-guardian/guardian-animation.module.css"

type GuardianSpriteProps = {
  profile: GuardianProfile
  visualState: GuardianVisualState
  reducedMotion?: boolean
  size?: "sm" | "sql" | "md"
  onClick?: () => void
  className?: string
}

const STATE_LABEL: Record<GuardianVisualState, string> = {
  idle: "idle",
  walking: "walking",
  talking: "talking",
  thinking: "thinking",
  sleeping: "sleeping",
  jumping: "jumping",
  teleporting: "teleporting",
  celebrating: "celebrating",
  hidden: "hidden",
}

const STATE_CLASS: Record<GuardianVisualState, string> = {
  idle: styles.stateIdle,
  walking: styles.stateWalking,
  talking: styles.stateTalking,
  thinking: styles.stateThinking,
  sleeping: styles.stateSleeping,
  jumping: styles.stateJumping,
  teleporting: styles.stateTeleporting,
  celebrating: styles.stateCelebrating,
  hidden: "",
}

const AURA_CLASS: Record<GuardianAura, string> = {
  none: "",
  soft: styles.auraSoft,
  compass: styles.auraCompass,
  "star-map": styles.auraStarMap,
}

export function GuardianSprite({
  profile,
  visualState,
  reducedMotion = false,
  size = "md",
  onClick,
  className,
}: GuardianSpriteProps) {
  const id = useId()
  if (visualState === "hidden") return null

  const isCompact = size === "sm"
  const isSqlSize = size === "sql"
  const isThinking = visualState === "thinking"
  const isTalking = visualState === "talking"
  const isSleeping = visualState === "sleeping"
  const isTeleporting = visualState === "teleporting"
  const isCelebrating = visualState === "celebrating"
  const visualForm = getGuardianVisualForm({ formStage: profile.formStage, level: profile.level })
  const moodVisual = getGuardianMoodVisual(profile.mood)
  const showCloak = visualForm.formStage !== "seed"
  const showStarMap = visualForm.formStage === "navigator" || visualForm.formStage === "guardian"
  const showBeam = visualForm.formStage === "navigator" || visualForm.formStage === "guardian"
  const showGuardianMarks = visualForm.formStage === "guardian"
  const shellGradientId = `${id}-guardian-shell`
  const sailGradientId = `${id}-guardian-sail`
  const cloakGradientId = `${id}-guardian-cloak`
  const runeGradientId = `${id}-guardian-rune`
  const beamGradientId = `${id}-guardian-beam`

  return (
    <button
      type="button"
      onClick={onClick}
      data-form-stage={visualForm.formStage}
      data-mood={moodVisual.mood}
      data-visual-state={visualState}
      data-sprite-size={size}
      className={cn(
        styles.spriteButton,
        reducedMotion ? styles.reduced : STATE_CLASS[visualState],
        "group relative isolate flex items-center justify-center rounded-full border bg-[--color-bg-surface] shadow-[0_12px_30px_rgba(15,23,42,0.13)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        visualForm.borderClassName,
        styles[visualForm.cssClassName],
        styles[moodVisual.cssClassName],
        `guardian-form-${visualForm.formStage}`,
        isCompact ? "size-12" : isSqlSize ? "size-[68px]" : "size-20",
        className
      )}
      aria-label={`SQL Guardian ${profile.name}, ${STATE_LABEL[visualState]}`}
      title={isSleeping ? "Wake SQL Guardian" : "Talk with SQL Guardian"}
    >
      <span className={styles.teleportRing} aria-hidden="true" />
      <span className={cn(styles.stageAura, AURA_CLASS[visualForm.aura])} aria-hidden="true" />
      <span className={cn(styles.sparkOne, isSqlSize ? styles.sparkQuiet : "")} aria-hidden="true" />
      <span className={cn(styles.sparkTwo, isSqlSize ? styles.sparkQuiet : "")} aria-hidden="true" />
      <span
        className={cn(
          "absolute rounded-full bg-cyan-300/20 blur-md",
          isCompact ? "inset-1" : isSqlSize ? "inset-1.5" : "inset-2",
          (isThinking || isTeleporting || isCelebrating) && !reducedMotion ? "animate-pulse" : ""
        )}
      />
      <svg
        viewBox="0 0 96 96"
        role="img"
        aria-hidden="true"
        className={cn("relative drop-shadow-sm", isCompact ? "size-10" : isSqlSize ? "size-[60px]" : "size-[72px]")}
      >
        <defs>
          <linearGradient id={shellGradientId} x1="20" x2="76" y1="18" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E0F7FA" />
            <stop offset="0.52" stopColor="#67E8F9" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id={sailGradientId} x1="34" x2="70" y1="10" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF7ED" />
            <stop offset="1" stopColor="#FBBF24" />
          </linearGradient>
          <linearGradient id={cloakGradientId} x1="24" x2="72" y1="41" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.42" />
            <stop offset="0.55" stopColor="#0F766E" stopOpacity="0.5" />
            <stop offset="1" stopColor="#0F172A" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={runeGradientId} x1="30" x2="70" y1="66" y2="66" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ECFEFF" />
            <stop offset="0.5" stopColor="#FDE68A" />
            <stop offset="1" stopColor="#A7F3D0" />
          </linearGradient>
          <radialGradient id={beamGradientId} cx="0" cy="0" r="1" gradientTransform="matrix(24 0 0 36 70 21)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#BAE6FD" stopOpacity="0.7" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
        </defs>

        {showBeam ? (
          <path
            d="M66 14c12 7 18 18 20 35-9-10-18-14-30-13 3-8 6-15 10-22Z"
            fill={`url(#${beamGradientId})`}
            opacity={isSqlSize ? 0.18 : 0.36}
          />
        ) : null}
        {showCloak ? (
          <path
            d="M26 58c7 18 19 25 36 21 4-9 6-18 3-28-8 6-17 9-27 7-5-1-9-1-12 0Z"
            fill={`url(#${cloakGradientId})`}
          />
        ) : null}
        {showStarMap ? (
          <g opacity={isSqlSize ? 0.38 : 0.62}>
            <path d="M31 73 42 66l12 8 13-12" fill="none" stroke="#DBEAFE" strokeLinecap="round" strokeWidth="1.2" />
            <circle cx="31" cy="73" r="1.4" fill="#FDE68A" />
            <circle cx="42" cy="66" r="1.4" fill="#E0F2FE" />
            <circle cx="54" cy="74" r="1.4" fill="#A7F3D0" />
            <circle cx="67" cy="62" r="1.4" fill="#FDE68A" />
          </g>
        ) : null}
        <path d="M21 63c3-20 17-34 29-34s25 14 28 34c-8 10-18 15-29 15S29 73 21 63Z" fill={`url(#${shellGradientId})`} />
        <path d="M28 63c7 6 14 9 21 9s14-3 21-9" fill="none" stroke="#0F172A" strokeOpacity="0.28" strokeWidth="2" />
        <path d="M36 31 50 13l17 33-17-6-14 8Z" fill={`url(#${sailGradientId})`} stroke="#92400E" strokeOpacity="0.45" strokeWidth="1.5" />
        {visualForm.formStage !== "seed" ? (
          <path d="M40 35c8 1 15 4 21 9" fill="none" stroke="#0E7490" strokeDasharray="2 3" strokeLinecap="round" strokeWidth="1.5" />
        ) : null}
        <path d="M49 15v57" stroke="#134E4A" strokeLinecap="round" strokeWidth="2.5" />
        <path d="M31 54c6-5 12-8 18-8s13 3 19 8" fill="none" stroke="#ECFEFF" strokeLinecap="round" strokeWidth="4" />
        {isSleeping ? (
          <>
            <path d="M34 58h8M57 58h8" stroke="#0F172A" strokeLinecap="round" strokeWidth="2.5" />
            <path d="M36 55c2 2 4 2 6 0M59 55c2 2 4 2 6 0" stroke="#0E7490" strokeLinecap="round" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <circle cx="38" cy="58" r={isThinking ? 3.4 : 4} fill="#0F172A" />
            <circle cx="61" cy="58" r={isThinking ? 3.4 : 4} fill="#0F172A" />
            <circle cx="39.5" cy="56.5" r="1.2" fill="#E0F2FE" />
            <circle cx="62.5" cy="56.5" r="1.2" fill="#E0F2FE" />
          </>
        )}
        <path
          d={isTalking ? "M42 68c5 4 10 4 15 0" : isSleeping ? "M42 68c4 1 9 1 14 0" : isCelebrating ? "M41 66c6 6 12 6 18 0" : "M43 68c4 3 9 3 13 0"}
          fill="none"
          stroke="#0F172A"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <g opacity={visualForm.formStage === "seed" ? 0.55 : 0.88}>
          <rect x="36" y="68" width="27" height="6" rx="3" fill={`url(#${runeGradientId})`} stroke="#0F766E" strokeOpacity="0.28" />
          <path d="M41 71h3M48 71h7M59 71h2" stroke="#0F172A" strokeLinecap="round" strokeOpacity="0.42" strokeWidth="1.1" />
        </g>

        <g className={cn(isThinking && !reducedMotion ? styles.compassThinking : "")}>
          <circle cx="72" cy="29" r="9" fill="#F8FAFC" stroke="#0E7490" strokeWidth="2" />
          <path d="m72 23 2.5 6.5L68 33l2.5-6.5Z" fill="#0891B2" />
          {showGuardianMarks ? <circle cx="72" cy="29" r="13" fill="none" stroke="#A7F3D0" strokeDasharray="2 4" strokeWidth="1.2" /> : null}
        </g>

        <g opacity={isSleeping ? 1 : 0} className={cn(!reducedMotion && isSleeping ? "animate-pulse" : "")}>
          <text x="70" y="20" fill="#0E7490" fontFamily="monospace" fontSize="10" fontWeight="700">
            Zz
          </text>
        </g>
        <g opacity={isThinking ? 1 : 0.45}>
          <path d="M23 34h9M18 42h13M22 50h7" stroke="#0E7490" strokeLinecap="round" strokeWidth="2" />
        </g>
        {moodVisual.mood === "confused" ? (
          <text x="19" y="27" fill="#0E7490" fontFamily="monospace" fontSize="11" fontWeight="700">
            ?
          </text>
        ) : null}
      </svg>
      <span className="sr-only">Lv.{profile.level}</span>
    </button>
  )
}

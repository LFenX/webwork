export type GuardianFormStage = "seed" | "sailor" | "navigator" | "guardian"

export type GuardianHomeVariant = "shell" | "harbor" | "lighthouse" | "star-port"

export type GuardianAura = "none" | "soft" | "compass" | "star-map"

export type GuardianFormVisualConfig = {
  formStage: GuardianFormStage
  minLevel: number
  label: string
  shortLabel: string
  aura: GuardianAura
  homeVariant: GuardianHomeVariant
  spriteVariant: string
  levelUpLine: string
  cssClassName: string
  borderClassName: string
  progressClassName: string
}

type MoodVisual = {
  mood: string
  label: string
  cssClassName: string
}

const FORM_VISUALS: Record<GuardianFormStage, GuardianFormVisualConfig> = {
  seed: {
    formStage: "seed",
    minLevel: 1,
    label: "Data Shell",
    shortLabel: "Seed",
    aura: "soft",
    homeVariant: "shell",
    spriteVariant: "shell-compass",
    levelUpLine: "My little compass just caught a new glimmer.",
    cssClassName: "stageSeed",
    borderClassName: "border-cyan-200",
    progressClassName: "bg-cyan-400/70",
  },
  sailor: {
    formStage: "sailor",
    minLevel: 3,
    label: "Query Harbor",
    shortLabel: "Sailor",
    aura: "soft",
    homeVariant: "harbor",
    spriteVariant: "route-cloak",
    levelUpLine: "A fresh query route is coming into view.",
    cssClassName: "stageSailor",
    borderClassName: "border-sky-300",
    progressClassName: "bg-sky-400/75",
  },
  navigator: {
    formStage: "navigator",
    minLevel: 5,
    label: "Index Star Map",
    shortLabel: "Navigator",
    aura: "compass",
    homeVariant: "lighthouse",
    spriteVariant: "index-compass",
    levelUpLine: "The index star map opened a little wider.",
    cssClassName: "stageNavigator",
    borderClassName: "border-amber-300",
    progressClassName: "bg-amber-400/75",
  },
  guardian: {
    formStage: "guardian",
    minLevel: 7,
    label: "Star Harbor",
    shortLabel: "Guardian",
    aura: "star-map",
    homeVariant: "star-port",
    spriteVariant: "star-harbor",
    levelUpLine: "The star harbor light is brighter now.",
    cssClassName: "stageGuardian",
    borderClassName: "border-emerald-300",
    progressClassName: "bg-emerald-400/75",
  },
}

const MOOD_VISUALS: Record<string, MoodVisual> = {
  calm: { mood: "calm", label: "Calm", cssClassName: "moodCalm" },
  curious: { mood: "curious", label: "Curious", cssClassName: "moodCurious" },
  focused: { mood: "focused", label: "Focused", cssClassName: "moodFocused" },
  sleepy: { mood: "sleepy", label: "Sleepy", cssClassName: "moodSleepy" },
  excited: { mood: "excited", label: "Excited", cssClassName: "moodExcited" },
  confused: { mood: "confused", label: "Off course", cssClassName: "moodConfused" },
  proud: { mood: "proud", label: "Proud", cssClassName: "moodProud" },
}

export function normalizeGuardianFormStage(input: unknown, level?: number): GuardianFormStage {
  if (input === "seed") return "seed"
  if (input === "sailor" || input === "voyager") return "sailor"
  if (input === "navigator") return "navigator"
  if (input === "guardian") return "guardian"
  if (input === "harbor") return "seed"
  if (typeof input === "string" && input.trim()) return "seed"

  if (typeof level === "number" && Number.isFinite(level)) {
    if (level >= 7) return "guardian"
    if (level >= 5) return "navigator"
    if (level >= 3) return "sailor"
  }

  return "seed"
}

export function getGuardianVisualForm(input: {
  formStage?: string | null
  level?: number
}): GuardianFormVisualConfig {
  return FORM_VISUALS[normalizeGuardianFormStage(input.formStage, input.level)]
}

export function getGuardianMoodVisual(mood?: string | null): MoodVisual {
  if (mood && MOOD_VISUALS[mood]) return MOOD_VISUALS[mood]
  return MOOD_VISUALS.curious
}

export function getGuardianLevelUpLine(input: {
  level: number
  title?: string
  formStage?: string | null
}) {
  const form = getGuardianVisualForm({ formStage: input.formStage, level: input.level })
  const title = input.title?.trim()
  const titlePart = title ? ` Current title: ${title}.` : ""

  return `${form.levelUpLine} Lv.${input.level} ${form.label} guardian online.${titlePart}`
}

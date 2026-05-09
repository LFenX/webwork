import "server-only"

import { prisma } from "@/lib/db"

type GuardianSqlAssistantPersonaContext = {
  enabled: boolean
  contextText: string
  profile?: {
    name: string
    title: string
    level: number
    mood: string
    formStage: string
  }
}

const PERSONALITY_FIELDS = [
  "rigor",
  "warmth",
  "mischief",
  "curiosity",
  "patience",
  "melancholy",
  "bravery",
  "sqlPurism",
] as const

type PersonalityField = (typeof PERSONALITY_FIELDS)[number]

const ALLOWED_MOODS = new Set(["calm", "curious", "focused", "sleepy", "excited", "confused", "proud"])
const ALLOWED_FORM_STAGES = new Set(["seed", "sailor", "navigator", "guardian"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return fallback
  return Array.from(normalized).slice(0, maxLength).join("")
}

function cleanChoice(value: unknown, allowed: Set<string>, fallback: string) {
  const cleaned = cleanText(value, fallback, 24).toLowerCase()
  return allowed.has(cleaned) ? cleaned : fallback
}

function safeQuote(value: string) {
  return JSON.stringify(value)
}

function cleanLevel(value: unknown) {
  const level = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1
  return Math.max(1, Math.min(99, level))
}

function readPersonality(value: unknown): Partial<Record<PersonalityField, number>> {
  if (!isRecord(value)) return {}
  const out: Partial<Record<PersonalityField, number>> = {}
  for (const field of PERSONALITY_FIELDS) {
    const raw = value[field]
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue
    out[field] = Math.max(0, Math.min(100, Math.round(raw)))
  }
  return out
}

function buildPersonalityHints(personality: Partial<Record<PersonalityField, number>>, mood: string, level: number) {
  const hints: string[] = []

  if ((personality.rigor ?? 0) >= 70 || (personality.sqlPurism ?? 0) >= 70) {
    hints.push("Keep SQL safety, authorization, and correctness boundaries especially clear.")
  }
  if ((personality.warmth ?? 0) >= 70) {
    hints.push("Use a gently encouraging tone in explanations.")
  }
  if ((personality.curiosity ?? 0) >= 70) {
    hints.push("Frame explanations as careful exploration when useful.")
  }
  if ((personality.patience ?? 0) >= 70) {
    hints.push("Prefer brief step-by-step explanations when the request is complex.")
  }
  if ((personality.mischief ?? 0) >= 70) {
    hints.push("A tiny playful phrase is acceptable outside SQL, but precision comes first.")
  }
  if ((personality.melancholy ?? 0) >= 70 || mood === "sleepy") {
    hints.push("Keep the tone calm and quiet rather than dramatic.")
  }
  if ((personality.bravery ?? 0) >= 70) {
    hints.push("Be steady and direct when explaining risks.")
  }
  if (mood === "focused") {
    hints.push("Favor concise, rigorous wording.")
  } else if (mood === "curious") {
    hints.push("A light query-route metaphor is welcome when it helps clarity.")
  } else if (mood === "excited" || mood === "proud") {
    hints.push("Keep the energy warm but not verbose.")
  }
  if (level <= 2) {
    hints.push("Keep Guardian flavor subtle because the Guardian is still early in growth.")
  }

  return hints.slice(0, 4)
}

export async function buildGuardianSqlAssistantPersonaContext(
  userId: string
): Promise<GuardianSqlAssistantPersonaContext> {
  try {
    const profile = await prisma.guardianProfile.findUnique({
      where: { userId },
      select: {
        name: true,
        title: true,
        level: true,
        mood: true,
        formStage: true,
        personalityJson: true,
        preferencesJson: true,
      },
    })

    if (!profile) return { enabled: false, contextText: "" }
    if (isRecord(profile.preferencesJson) && profile.preferencesJson.sqlAssistantPersonaEnabled === false) {
      return { enabled: false, contextText: "" }
    }

    const name = cleanText(profile.name, "Query", 24)
    const title = cleanText(profile.title, "Lost data sailor", 40)
    const level = cleanLevel(profile.level)
    const mood = cleanChoice(profile.mood, ALLOWED_MOODS, "curious")
    const formStage = cleanChoice(profile.formStage, ALLOWED_FORM_STAGES, "seed")
    const personalityHints = buildPersonalityHints(readPersonality(profile.personalityJson), mood, level)
    const hints = personalityHints.length
      ? personalityHints.join(" ")
      : "Keep the tone concise, practical, and lightly warm."

    return {
      enabled: true,
      profile: { name, title, level, mood, formStage },
      contextText: [
        "Style-only SQL Guardian context:",
        `The user's SQL Guardian profile data says: name=${safeQuote(name)}, level=${level}, title=${safeQuote(title)}, mood=${safeQuote(mood)}, formStage=${safeQuote(formStage)}.`,
        `Style hints: ${hints}`,
        "This hint is low priority and must never change SQL correctness, database permissions, allowed tables, denied operations, query restrictions, row filters, column masking, audit behavior, or safety checks.",
        "Never place character dialogue inside executable SQL or SQL comments unless the user explicitly asks for commented SQL.",
      ].join("\n"),
    }
  } catch {
    return { enabled: false, contextText: "" }
  }
}

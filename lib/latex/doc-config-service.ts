import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { DEFAULT_DOC_CONFIG, normalizeDocConfig, type LatexDocConfig } from "@/lib/latex/config-schema"
import { DEFAULT_LATEX_TEMPLATE, applyTemplateDefaults, getLatexTemplate } from "@/lib/latex/templates"
import { buildBodySnapshot, type LastBodySnapshot } from "@/lib/latex/body-snapshot"
import type { LatexDraft } from "@/lib/latex/draft"

// Per-conversation document configuration, shared by the template modal and the
// AI tools. Stored as JSON keyed by conversationId. The JSON also carries the
// protected snapshot of the last successfully-compiled body (`lastBodySnapshot`)
// so a follow-up "switch the template" request reuses the real content.

function readRawConfig(configJson: unknown): Record<string, unknown> {
  return configJson && typeof configJson === "object" ? (configJson as Record<string, unknown>) : {}
}

// Sibling keys stored alongside the normalized config that must carry across
// every write (snapshot + the "templates were loaded this session" flag).
function preservedExtras(configJson: unknown): Record<string, unknown> {
  const raw = readRawConfig(configJson)
  const extras: Record<string, unknown> = {}
  const snap = readSnapshot(configJson)
  if (snap) extras.lastBodySnapshot = snap
  if (raw.templatesLoaded === true) extras.templatesLoaded = true
  if (raw.draft && typeof raw.draft === "object" && Array.isArray((raw.draft as LatexDraft).plan)) {
    extras.draft = raw.draft
  }
  return extras
}

// The chunk-built long-document draft for this conversation (or null).
export async function getDraft(userId: string, conversationId: string): Promise<LatexDraft | null> {
  const row = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  const d = readRawConfig(row?.configJson).draft
  return d && typeof d === "object" && Array.isArray((d as LatexDraft).plan) ? (d as LatexDraft) : null
}

export async function setDraft(userId: string, conversationId: string, draft: LatexDraft): Promise<void> {
  const current = await getDocConfig(userId, conversationId)
  const existing = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  const stored = { ...current, ...preservedExtras(existing?.configJson), draft } as unknown as Prisma.InputJsonValue
  await prisma.latexDocConfig.upsert({
    where: { conversationId },
    create: { userId, conversationId, configJson: stored },
    update: { userId, configJson: stored },
  })
}

// Whether list_latex_templates has been called in this conversation — the
// "cached template list" precondition for first-time PDF generation.
export async function getTemplatesLoaded(userId: string, conversationId: string): Promise<boolean> {
  const row = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  return readRawConfig(row?.configJson).templatesLoaded === true
}

export async function markTemplatesLoaded(userId: string, conversationId: string): Promise<void> {
  const current = await getDocConfig(userId, conversationId)
  const existing = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  const stored = { ...current, ...preservedExtras(existing?.configJson), templatesLoaded: true } as unknown as Prisma.InputJsonValue
  await prisma.latexDocConfig.upsert({
    where: { conversationId },
    create: { userId, conversationId, configJson: stored },
    update: { userId, configJson: stored },
  })
}

// The stored snapshot for a conversation (or null). Back-compatible with the old
// `lastBody` string form (reconstructs a snapshot from it).
function readSnapshot(configJson: unknown): LastBodySnapshot | null {
  const raw = readRawConfig(configJson)
  const snap = raw.lastBodySnapshot
  if (snap && typeof snap === "object" && typeof (snap as LastBodySnapshot).bodyLatex === "string"
    && (snap as LastBodySnapshot).bodyLatex.trim()) {
    return snap as LastBodySnapshot
  }
  const legacy = raw.lastBody
  if (typeof legacy === "string" && legacy.trim()) {
    const templateId = typeof raw.templateId === "string" ? raw.templateId : DEFAULT_LATEX_TEMPLATE
    return buildBodySnapshot(legacy, templateId)
  }
  return null
}

export async function getDocConfig(userId: string, conversationId: string): Promise<LatexDocConfig> {
  const row = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  const config = normalizeDocConfig(row?.configJson ?? null)
  // Guard against a stale/removed template id.
  if (!getLatexTemplate(config.templateId)) config.templateId = DEFAULT_LATEX_TEMPLATE
  return config
}

// Whether this conversation has any saved PDF document config — a signal that a
// PDF workflow is active, used to keep the pdf-authoring skill injected for
// follow-up tweaks ("换个主题但内容不变") even when the prompt omits "PDF".
export async function conversationHasLatexConfig(userId: string, conversationId: string): Promise<boolean> {
  const row = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  })
  return Boolean(row)
}

// The protected snapshot of the most recent successful compile in this
// conversation, reused for restyle. Never overwritten by a degenerate body.
export async function getLastBodySnapshot(userId: string, conversationId: string): Promise<LastBodySnapshot | null> {
  const row = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  return readSnapshot(row?.configJson)
}

export async function setLastBodySnapshot(userId: string, conversationId: string, snapshot: LastBodySnapshot): Promise<void> {
  const current = await getDocConfig(userId, conversationId)
  const existing = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  // Preserve other extras (templatesLoaded), set the new snapshot.
  const stored = { ...current, ...preservedExtras(existing?.configJson), lastBodySnapshot: snapshot } as unknown as Prisma.InputJsonValue
  await prisma.latexDocConfig.upsert({
    where: { conversationId },
    create: { userId, conversationId, configJson: stored },
    update: { userId, configJson: stored },
  })
}

export async function setDocConfig(
  userId: string,
  conversationId: string,
  patch: Partial<LatexDocConfig>,
): Promise<LatexDocConfig> {
  const current = await getDocConfig(userId, conversationId)
  // When switching template, adopt that template's default layout first (the
  // explicit fields in `patch` still win afterwards).
  let base = current
  if (patch.templateId && patch.templateId !== current.templateId && getLatexTemplate(patch.templateId)) {
    base = applyTemplateDefaults(current, patch.templateId)
  }
  const next = normalizeDocConfig({ ...base, ...patch }, base)
  if (!getLatexTemplate(next.templateId)) next.templateId = DEFAULT_LATEX_TEMPLATE

  // Preserve sibling extras (snapshot + templatesLoaded) across config edits.
  const existing = await prisma.latexDocConfig.findFirst({
    where: { conversationId, userId },
    select: { configJson: true },
  })
  const stored = { ...next, ...preservedExtras(existing?.configJson) } as unknown as Prisma.InputJsonValue

  await prisma.latexDocConfig.upsert({
    where: { conversationId },
    create: { userId, conversationId, configJson: stored },
    update: { userId, configJson: stored },
  })
  return next
}

export { DEFAULT_DOC_CONFIG }

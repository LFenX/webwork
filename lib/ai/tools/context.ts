import "server-only"
import { getUserAdminInfo, hasAdminPermission, type AdminUser } from "@/lib/admin"
import type { AIToolAccessScope, AIToolSensitivity } from "@/lib/ai/types"

export type AIToolActor = {
  userId: string
  admin: AdminUser | null
}

export type AIToolContext = {
  userId: string
  actor: AIToolActor
  targetUserId: string
  scope: AIToolAccessScope
}

export type AIToolDefinition<TInput extends Record<string, unknown> | void = void> = {
  name: string
  title: string
  description: string
  scope: AIToolAccessScope
  inputSchemaSummary: string
  sensitivity: AIToolSensitivity
  auditLabel: string
  execute: (ctx: AIToolContext & (TInput extends void ? Record<string, never> : TInput)) => Promise<unknown>
}

export async function createAIToolActor(userId: string): Promise<AIToolActor> {
  const admin = await getUserAdminInfo(userId).catch(() => null)
  return {
    userId,
    admin: admin && (admin.role === "owner" || admin.role === "admin") ? admin : null,
  }
}

export function buildAIToolContext(params: {
  actor: AIToolActor
  targetUserId?: string | null
  scope: AIToolAccessScope
}): AIToolContext {
  const targetUserId = params.targetUserId ?? params.actor.userId
  assertAIToolAccess(params.actor, params.scope, targetUserId)
  return {
    userId: params.actor.userId,
    actor: params.actor,
    targetUserId,
    scope: params.scope,
  }
}

export function assertAIToolAccess(actor: AIToolActor, scope: AIToolAccessScope, targetUserId?: string | null) {
  if (scope === "self") {
    if (targetUserId && targetUserId !== actor.userId) {
      throw new Error("AI_TOOL_SELF_SCOPE_FORBIDDEN")
    }
    return
  }

  if (scope === "visible-user") {
    if (!targetUserId) throw new Error("AI_TOOL_TARGET_REQUIRED")
    return
  }

  if (!targetUserId) throw new Error("AI_TOOL_TARGET_REQUIRED")
  if (targetUserId === actor.userId) return

  const admin = actor.admin
  if (!admin) throw new Error("AI_TOOL_ADMIN_REQUIRED")

  if (hasAdminPermission(admin, "viewActivityLogs") || hasAdminPermission(admin, "manageUsers") || hasAdminPermission(admin, "manageAI")) {
    return
  }

  throw new Error("AI_TOOL_ADMIN_SCOPE_FORBIDDEN")
}

export function maskIpAddress(value: string) {
  if (!value) return ""
  if (value.includes(":")) {
    const parts = value.split(":")
    return `${parts.slice(0, 3).join(":")}:*:*`
  }
  const parts = value.split(".")
  if (parts.length !== 4) return value
  return `${parts[0]}.${parts[1]}.x.x`
}

export function compactText(value: string, size = 120) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= size) return normalized
  return `${normalized.slice(0, size)}...`
}

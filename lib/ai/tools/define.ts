import "server-only"
import { z } from "zod"
import type {
  AIToolAccessScope,
  AIToolDescriptor,
  AIToolSensitivity,
  AIToolStructuredResult,
} from "@/lib/ai/types"
import type { AIToolContext } from "@/lib/ai/tools/context"

// ───────────────────────────────────────────────────────────────────────────
// Single source of truth for an AI tool.
//
// Phase 0 of the tool-management upgrade: this module introduces the *unified*
// self-describing tool shape. Each tool declares everything about itself here —
// metadata, category, trigger phrases, and a zod `input` schema. From this one
// object we DERIVE (see derive.ts): the provider JSON Schema, the admin-facing
// AIToolDescriptor, the capability map + system-prompt summary, and the
// heuristic-router seeds. Nothing about a tool should live in a second place.
//
// This file is additive. It does not change runtime behavior on its own; the
// existing registry keeps working until tools are migrated onto defineTool().
// ───────────────────────────────────────────────────────────────────────────

// Canonical capability categories. These mirror the ids the capability map has
// always used, so the derived map is a drop-in replacement. Keep this list and
// the human labels in capability metadata (derive.ts) in sync — the invariant
// checker enforces that every category has at least one non-deprecated tool.
export const TOOL_CATEGORIES = [
  "self-profile",
  "resume",
  "posts",
  "jobs",
  "interviews",
  "uploads-pdf",
  "knowledge",
  "pdf-generation",
  "web-search",
  "soulwing-conversations",
  "chat",
  "friends",
  "memory",
  "persona",
  "auto-reply",
  "module-settings",
  "visible-user",
  "admin",
  "capabilities",
  "diagnostics",
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

// Confirmation policy, declared per tool instead of re-implemented ad hoc inside
// each execute() and restated in the system prompt. The runtime can enforce
// "required-for-write" centrally (a high-impact write must carry an explicit
// confirmedByUser flag in its input before it runs).
export type ToolConfirmation = "none" | "required-for-write"

export type ToolDeprecation = {
  // When it was deprecated (YYYY-MM-DD), for the removal grace window.
  since: string
  // The tool name that replaces it. The invariant checker verifies this points
  // at a real, non-deprecated tool.
  replacement: string
}

// The execute context: the resolved tool context plus the validated, typed input
// (zod-inferred). Tools always receive input that has already passed safeParse,
// so execute() never has to re-validate shape — only enforce business rules.
export type ToolExecuteContext<S extends z.ZodType> = AIToolContext & z.infer<S>

export type UnifiedToolDefinition<S extends z.ZodType = z.ZodTypeAny> = {
  // Globally unique. Naming convention: verb_scope_object (e.g. get_my_profile,
  // list_admin_users). Enforced by the invariant checker.
  name: string
  title: string
  description: string
  category: ToolCategory
  scope: AIToolAccessScope
  sensitivity: AIToolSensitivity
  // Globally unique audit label used in AI audit logs.
  auditLabel: string
  whenToUse: string
  whenNotToUse: string
  // Trigger phrases that surface this tool in the capability map and seed the
  // heuristic router. Previously hand-kept in capability-map.ts; now co-located
  // with the tool so it can never drift.
  triggers: string[]
  returns: string
  // Optional argument hints folded into the provider-facing tool description
  // (kept for parity with the legacy descriptor). New tools should prefer
  // per-field zod `.describe()` annotations, which also surface in the JSON
  // Schema; this field exists so migration stays behavior-preserving.
  argumentHints?: string[]
  // The parameter schema. A zod `input` is the target: it validates model
  // arguments before execute() AND is the source for the provider JSON Schema.
  // During migration a tool may instead carry `rawParameterSchema` (its legacy
  // hand-written JSON Schema) — such tools derive the same provider schema but
  // skip pre-execution validation until they adopt a zod input. Exactly one of
  // `input` / `rawParameterSchema` must be present (the invariant checker
  // enforces this).
  input?: S
  rawParameterSchema?: Record<string, unknown>
  confirmation?: ToolConfirmation
  deprecated?: ToolDeprecation
  // Soft-deprecated alias that forwards to another tool's implementation. Kept
  // resolvable in AI_TOOL_MAP (so historical/stale calls don't error) but
  // filtered out of the provider tool list. Used when merging duplicate tools.
  aliasOf?: string
  execute: (ctx: ToolExecuteContext<S>) => Promise<AIToolStructuredResult>
}

// Identity helper: declares a tool with full type inference on `input`. Today it
// just brands the object; the registry collects these and derive.ts produces the
// downstream artifacts. Kept intentionally thin so there is no hidden behavior.
export function defineTool<S extends z.ZodType>(def: UnifiedToolDefinition<S>): UnifiedToolDefinition<S> {
  return def
}

// Convert a tool's zod input schema to the provider-facing JSON Schema. zod 4's
// z.toJSONSchema emits a 2020-12 document with a `$schema` key; we drop that key
// for parity with the legacy hand-written schemas (OpenAI-compatible function
// calling ignores `$schema` anyway, and dropping it keeps the diff clean during
// migration). Everything else (integer min/max, enum, required, strict
// additionalProperties:false) already matches the old switch output.
export function toToolJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>
  delete json.$schema
  return json
}

// The empty-input JSON Schema (no parameters). Matches the legacy switch default.
export const EMPTY_PARAMETER_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
}

// A human-readable one-line summary of a parameter JSON Schema, replacing the
// old hand-written `inputSchemaSummary` strings. Example:
//   "query: string, limit?: number"  /  "无需输入"
export function summarizeJsonSchema(json: Record<string, unknown> | undefined): string {
  const props = ((json?.properties as Record<string, { type?: string; enum?: unknown[] }>) ?? {})
  const keys = Object.keys(props)
  if (keys.length === 0) return "无需输入"
  const required = new Set((Array.isArray(json?.required) ? json?.required : []) as string[])
  return keys
    .map((key) => {
      const prop = props[key]
      const type = prop.enum ? "string" : prop.type === "integer" ? "number" : (prop.type ?? "value")
      return `${key}${required.has(key) ? "" : "?"}: ${type}`
    })
    .join(", ")
}

export function summarizeInputSchema(schema: z.ZodType): string {
  return summarizeJsonSchema(toToolJsonSchema(schema))
}

// The provider-facing JSON Schema for a tool, from its zod `input` if present,
// else its raw schema, else empty. Single place both consumers and the parity
// check go through.
export function resolveToolParameters(def: Pick<UnifiedToolDefinition, "input" | "rawParameterSchema">): Record<string, unknown> {
  if (def.input) return toToolJsonSchema(def.input)
  if (def.rawParameterSchema) return def.rawParameterSchema
  return EMPTY_PARAMETER_SCHEMA
}

export type ToolInputValidation =
  | { success: true; data: Record<string, unknown> }
  | { success: false; message: string }

// Validate model-supplied arguments before execute(). zod tools are parsed
// (unknown keys stripped, missing/typed-wrong required fields rejected). Tools
// still on a raw schema are passed through unchanged (validation lands when they
// adopt a zod input) — behavior-preserving during migration.
export function validateToolInput(
  def: Pick<UnifiedToolDefinition, "input">,
  args: Record<string, unknown>,
): ToolInputValidation {
  if (!def.input) return { success: true, data: args }
  const parsed = def.input.safeParse(args)
  if (parsed.success) return { success: true, data: parsed.data as Record<string, unknown> }
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ")
  return { success: false, message }
}

// Project a unified definition down to the existing admin-facing descriptor
// shape, so consumers of AI_TOOL_DESCRIPTORS see no change.
export function toToolDescriptor(def: UnifiedToolDefinition): AIToolDescriptor {
  const parameterSchema = resolveToolParameters(def)
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    scope: def.scope,
    inputSchemaSummary: summarizeJsonSchema(parameterSchema),
    sensitivity: def.sensitivity,
    auditLabel: def.auditLabel,
    whenToUse: def.whenToUse,
    whenNotToUse: def.whenNotToUse,
    argumentHints: def.argumentHints,
    returns: def.returns,
    deprecated: Boolean(def.deprecated),
    parameterSchema,
  }
}

export type { AIToolAccessScope, AIToolSensitivity, AIToolStructuredResult }

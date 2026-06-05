/**
 * Tool-registry invariant checker.
 *
 * Build-time guard for the AI tool system. Fails (non-zero exit) on any broken
 * invariant so adding/editing/removing a tool can't silently drift. Wired into
 * `npm run check:tools` alongside the schema-parity check.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.preview.json scripts/check-tool-registry.ts
 *
 * Phase 0 scope: validates the CURRENT registry + capability map. As tools
 * migrate onto the unified defineTool() shape, extend with the zod-input /
 * category / triggers invariants from derive.ts.
 */
import "dotenv/config"
import { AI_TOOLS_REGISTRY, AI_TOOL_MAP } from "@/lib/ai/tools/registry"
import { AI_CAPABILITY_CATEGORIES } from "@/lib/ai/capability-map"
import { TOOL_CATEGORIES, resolveToolParameters } from "@/lib/ai/tools/define"

const errors: string[] = []
const warnings: string[] = []

const NAME_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/

// 1. Unique tool names.
const nameCounts = new Map<string, number>()
for (const tool of AI_TOOLS_REGISTRY) nameCounts.set(tool.name, (nameCounts.get(tool.name) ?? 0) + 1)
for (const [name, count] of nameCounts) if (count > 1) errors.push(`Duplicate tool name: ${name} (${count}×)`)

// 2. Unique audit labels.
const auditCounts = new Map<string, number>()
for (const tool of AI_TOOLS_REGISTRY) auditCounts.set(tool.auditLabel, (auditCounts.get(tool.auditLabel) ?? 0) + 1)
for (const [label, count] of auditCounts) if (count > 1) errors.push(`Duplicate auditLabel: ${label} (${count}×)`)

// 3. Naming convention (verb_scope_object, lower_snake_case with ≥1 underscore).
for (const tool of AI_TOOLS_REGISTRY) {
  if (!NAME_RE.test(tool.name)) errors.push(`Tool name violates naming convention: ${tool.name}`)
}

// 4. Required descriptive metadata present and non-empty.
for (const tool of AI_TOOLS_REGISTRY) {
  if (!tool.title?.trim()) errors.push(`Tool ${tool.name} missing title`)
  if (!tool.description?.trim()) errors.push(`Tool ${tool.name} missing description`)
  if (!tool.whenToUse?.trim()) errors.push(`Tool ${tool.name} missing whenToUse`)
  if (!tool.scope) errors.push(`Tool ${tool.name} missing scope`)
  if (!tool.sensitivity) errors.push(`Tool ${tool.name} missing sensitivity`)
}

// 5. AI_TOOL_MAP resolves every registered tool, and vice-versa.
for (const tool of AI_TOOLS_REGISTRY) {
  if (!AI_TOOL_MAP.has(tool.name)) errors.push(`Tool ${tool.name} not present in AI_TOOL_MAP`)
}
if (AI_TOOL_MAP.size !== nameCounts.size) {
  warnings.push(`AI_TOOL_MAP size (${AI_TOOL_MAP.size}) != unique tool names (${nameCounts.size})`)
}

// 6. Capability-map coverage — the drift guard.
//    a) every name listed in the capability map is a real registered tool;
//    b) every non-deprecated tool appears in at least one capability category.
const registeredNames = new Set(AI_TOOLS_REGISTRY.map((t) => t.name))
const capabilityNames = new Set<string>()
for (const category of AI_CAPABILITY_CATEGORIES) {
  for (const tool of category.tools) {
    capabilityNames.add(tool.name)
    if (!registeredNames.has(tool.name)) {
      errors.push(`Capability map lists unknown tool: ${tool.name} (category ${category.id})`)
    }
  }
}
for (const tool of AI_TOOLS_REGISTRY) {
  if (tool.deprecated) continue
  if (!capabilityNames.has(tool.name)) {
    errors.push(`Non-deprecated tool not covered by capability map: ${tool.name}`)
  }
}

// 7. Unified-shape invariants: valid category, triggers array, exactly one
//    schema source (zod input XOR raw JSON), and a resolvable provider schema.
const validCategories = new Set<string>(TOOL_CATEGORIES)
for (const tool of AI_TOOLS_REGISTRY) {
  if (!tool.category || !validCategories.has(tool.category)) {
    errors.push(`Tool ${tool.name} has invalid/missing category: ${String(tool.category)}`)
  }
  if (!Array.isArray(tool.triggers)) errors.push(`Tool ${tool.name} missing triggers array`)
  if (tool.input && tool.rawParameterSchema) {
    errors.push(`Tool ${tool.name} declares BOTH zod input and rawParameterSchema (choose one)`)
  }
  if (!tool.deprecated && !tool.input && !tool.rawParameterSchema) {
    errors.push(`Tool ${tool.name} has neither a zod input nor a rawParameterSchema`)
  }
  try {
    const params = resolveToolParameters(tool)
    if (!params || typeof params !== "object") errors.push(`Tool ${tool.name} parameter schema did not resolve to an object`)
  } catch (e) {
    errors.push(`Tool ${tool.name} parameter schema threw: ${(e as Error).message}`)
  }
}

// 8. Deprecation replacements must point at a real, non-deprecated tool.
for (const tool of AI_TOOLS_REGISTRY) {
  if (!tool.deprecated) continue
  const replacement = AI_TOOL_MAP.get(tool.deprecated.replacement)
  if (!replacement) {
    errors.push(`Deprecated ${tool.name}: replacement '${tool.deprecated.replacement}' not found`)
  } else if (replacement.deprecated) {
    errors.push(`Deprecated ${tool.name}: replacement '${tool.deprecated.replacement}' is itself deprecated`)
  }
}

console.log("── Tool registry invariants ──")
console.log(`tools: ${AI_TOOLS_REGISTRY.length}  capability-listed: ${capabilityNames.size}  errors: ${errors.length}  warnings: ${warnings.length}`)

if (warnings.length) {
  console.log("\nWarnings:")
  for (const w of warnings) console.log(`  ! ${w}`)
}

if (errors.length) {
  console.error("\nErrors:")
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error(`\nFAIL: ${errors.length} invariant error(s).`)
  process.exit(1)
}

console.log("\nOK: all tool-registry invariants hold.")

/**
 * Phase-0 schema-parity check.
 *
 * Proves that the zod catalog (lib/ai/tools/schemas.ts), when converted to JSON
 * Schema, is byte-equivalent to the legacy schema each tool resolves today —
 * i.e. the runtime.ts `toolParametersSchema` switch for the switch-using tools.
 * Once this is green, the switch can be deleted in Phase 2 and replaced by the
 * zod schemas with zero change to what the provider sees.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.preview.json scripts/check-tool-schema-parity.ts
 *
 * Exit code 0 = all switch-using tools match. Non-zero = mismatch / missing.
 */
import "dotenv/config"
import { AI_TOOLS_REGISTRY } from "@/lib/ai/tools/registry"
import { toolParametersSchema } from "@/lib/ai/runtime"
import { toToolJsonSchema } from "@/lib/ai/tools/define"
import { TOOL_INPUT_SCHEMAS } from "@/lib/ai/tools/schemas"

// Canonicalize a JSON Schema for order-insensitive comparison: sort object keys
// recursively, sort `required`/`enum` arrays (order is semantically irrelevant
// there), and treat an absent `required` the same as an empty one.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      let v = obj[key]
      if ((key === "required" || key === "enum") && Array.isArray(v)) {
        v = [...v].sort()
      }
      out[key] = canonical(v)
    }
    return out
  }
  return value
}

// Normalize a JSON Schema object so an empty/absent `required` array doesn't
// register as a spurious diff between the switch and zod output.
function normalize(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema }
  if (Array.isArray(copy.required) && copy.required.length === 0) delete copy.required
  return canonical(copy) as Record<string, unknown>
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

type Row = { name: string; status: "match" | "mismatch" | "missing-zod" | "inline-skip" }

const rows: Row[] = []
const mismatches: Array<{ name: string; legacy: string; derived: string }> = []
const missing: string[] = []

for (const tool of AI_TOOLS_REGISTRY) {
  if (tool.deprecated) continue // deprecated tools are filtered from provider tools; schema irrelevant

  // A tool uses the switch only when it has no inline parameterSchema on the
  // final merged object. Inline-schema tools migrate later (not in this proof).
  const usesSwitch = !tool.parameterSchema
  if (!usesSwitch) {
    rows.push({ name: tool.name, status: "inline-skip" })
    continue
  }

  const legacy = normalize(toolParametersSchema(tool.name) as Record<string, unknown>)
  const zod = TOOL_INPUT_SCHEMAS[tool.name]
  if (!zod) {
    rows.push({ name: tool.name, status: "missing-zod" })
    missing.push(tool.name)
    continue
  }

  const derived = normalize(toToolJsonSchema(zod))
  if (stableStringify(legacy) === stableStringify(derived)) {
    rows.push({ name: tool.name, status: "match" })
  } else {
    rows.push({ name: tool.name, status: "mismatch" })
    mismatches.push({ name: tool.name, legacy: stableStringify(legacy), derived: stableStringify(derived) })
  }
}

const counts = rows.reduce<Record<string, number>>((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1
  return acc
}, {})

console.log("── Tool schema parity (zod catalog vs legacy switch) ──")
console.log(
  `match: ${counts.match ?? 0}  mismatch: ${counts.mismatch ?? 0}  ` +
    `missing-zod: ${counts["missing-zod"] ?? 0}  inline-skip(uses inline schema): ${counts["inline-skip"] ?? 0}`,
)

if (missing.length) {
  console.log("\nSwitch-using tools with NO zod schema in the catalog (add them):")
  for (const name of missing) console.log(`  - ${name}`)
}

if (mismatches.length) {
  console.log("\nMISMATCHES:")
  for (const m of mismatches) {
    console.log(`\n### ${m.name}`)
    console.log("legacy (switch):")
    console.log(m.legacy)
    console.log("derived (zod):")
    console.log(m.derived)
  }
}

if (missing.length || mismatches.length) {
  console.error(`\nFAIL: ${mismatches.length} mismatch(es), ${missing.length} missing.`)
  process.exit(1)
}

console.log("\nOK: every switch-using tool has a byte-equivalent zod schema.")

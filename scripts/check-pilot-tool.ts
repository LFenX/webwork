/**
 * Phase-0 pilot verification.
 *
 * Proves the full define → derive pipeline on the migrated get_my_profile:
 *  1. the derived provider JSON Schema equals the legacy effective schema;
 *  2. the derived descriptor matches the legacy descriptor's key fields;
 *  3. the tool appears in the derived capability map under its category;
 *  4. zod validation accepts valid input and rejects unknown keys (the
 *     pre-execution validation Phase 2 will enforce in the runtime).
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.preview.json scripts/check-pilot-tool.ts
 */
import "dotenv/config"
import { getMyProfileToolV2 } from "@/lib/ai/tools/pilot-get-my-profile"
import {
  deriveProviderToolSpecs,
  deriveToolDescriptors,
  deriveCapabilityCategories,
} from "@/lib/ai/tools/derive"
import { toolParametersSchema } from "@/lib/ai/runtime"
import { AI_TOOL_MAP } from "@/lib/ai/tools/registry"
import { TOOL_INPUT_SCHEMAS } from "@/lib/ai/tools/schemas"

const failures: string[] = []
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label + (detail ? ` — ${detail}` : ""))
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

const tools = [getMyProfileToolV2]

console.log("── Pilot: get_my_profile (unified) ──")

// 1. Provider JSON Schema parity with the legacy switch output.
const spec = deriveProviderToolSpecs(tools)[0]
const legacySchema = toolParametersSchema("get_my_profile")
check(
  "provider parameters == legacy effective schema",
  JSON.stringify(spec.function.parameters) === JSON.stringify(legacySchema),
  `derived=${JSON.stringify(spec.function.parameters)} legacy=${JSON.stringify(legacySchema)}`,
)

// The provider description should fold in the same metadata pieces as before.
const legacyTool = AI_TOOL_MAP.get("get_my_profile")
check("provider description includes legacy description", spec.function.description.includes(legacyTool?.description ?? "###"))
check("provider description includes whenToUse", spec.function.description.includes("Use when:"))

// 2. Descriptor key fields.
const descriptor = deriveToolDescriptors(tools)[0]
check("descriptor name", descriptor.name === "get_my_profile")
check("descriptor scope", descriptor.scope === legacyTool?.scope)
check("descriptor sensitivity", descriptor.sensitivity === legacyTool?.sensitivity)
check("descriptor auditLabel", descriptor.auditLabel === legacyTool?.auditLabel)
check("descriptor inputSchemaSummary derived", descriptor.inputSchemaSummary === "无需输入", descriptor.inputSchemaSummary)

// 3. Capability map placement.
const categories = deriveCapabilityCategories(tools)
const selfProfile = categories.find((c) => c.id === "self-profile")
check("capability category self-profile present", Boolean(selfProfile))
check("capability lists get_my_profile", Boolean(selfProfile?.tools.some((t) => t.name === "get_my_profile")))
check(
  "capability carries triggers",
  Boolean(selfProfile?.tools.find((t) => t.name === "get_my_profile")?.triggers.includes("我的邮箱")),
)

// 4. Pre-execution validation semantics:
//    - accepts valid input;
//    - strips unknown keys (lenient — no hard reject over stray model noise),
//      while the derived JSON Schema still advertises additionalProperties:false;
//    - rejects input that violates a real constraint (missing required field),
//      which is the case Phase-2 runtime validation will turn into invalid_args.
const okParse = getMyProfileToolV2.input.safeParse({})
check("validation accepts {}", okParse.success)
const strip = getMyProfileToolV2.input.safeParse({ unexpected: 1 })
check(
  "validation strips unknown key (parses, key removed)",
  strip.success && !("unexpected" in (strip.data as Record<string, unknown>)),
)
const requiredMissing = TOOL_INPUT_SCHEMAS.search_user_memory.safeParse({})
check("validation rejects missing required field (search_user_memory.query)", !requiredMissing.success)

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} pilot check(s) failed.`)
  process.exit(1)
}
console.log("\nOK: pilot derives equivalent output and validates input.")

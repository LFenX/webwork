# 蝶灵 AI 工具管理系统

This directory is the AI assistant's tool system. It is built around a **single
source of truth**: the registry. Everything the model and UI see about a tool —
its provider JSON Schema, admin descriptor, capability listing, and the
heuristic-router seeds — is **derived** from one place. Do not hand-maintain tool
metadata anywhere else.

## Architecture

```
tool impl file (*.ts)        execute() logic
        │
registry.ts                  the manifest: metadata + category + triggers +
        │                    schema source (zod input OR rawParameterSchema)
        ▼
derive.ts ──► provider tool specs (runtime.ts → the model)
          ──► AI_TOOL_DESCRIPTORS (admin panel, via service.ts)
          ──► capability map + system-prompt summary (capability-map.ts)
          ──► trigger seeds (heuristic fallback router)
```

Key files:

- **`define.ts`** — the unified tool shape (`UnifiedToolDefinition`), the
  zod↔JSON-Schema bridge (`resolveToolParameters`, `toToolJsonSchema`), the
  input validator (`validateToolInput`), and `TOOL_CATEGORIES`.
- **`registry.ts`** — `RAW_TOOLS` (per-tool metadata + execute),
  `TOOL_CLASSIFICATION` (each tool's category + trigger phrases),
  `TOOL_DEPRECATIONS`, and the derived exports `AI_TOOLS_REGISTRY`,
  `AI_TOOL_DESCRIPTORS`, `AI_TOOL_MAP`.
- **`derive.ts`** — pure derivation functions + `CATEGORY_META` (the only
  hand-kept per-category label/description).
- **`schemas.ts`** — zod input schemas for tools that don't carry an inline one.
- **`capability-map.ts`** (parent dir) — thin re-export, fully derived.
- **`../runtime.ts`** — builds provider specs via `deriveProviderToolSpecs` and
  validates arguments via `validateToolInput` before executing a tool.

## Schema & validation

Every tool has exactly **one** parameter-schema source:

- **`input`** — a zod schema (preferred). It both validates the model's
  arguments before `execute()` and produces the provider JSON Schema.
- **`rawParameterSchema`** — a legacy hand-written JSON Schema, for tools not yet
  on zod. These skip pre-execution validation. Migrate them to zod when touched.

Validation is a **gate, not a rewrite**: invalid arguments (missing/typed-wrong
required fields) return a structured `invalid_args` result the model can recover
from; the original arguments (with injected `targetUserId`) are what `execute`
receives. The provider JSON Schema is strict (`additionalProperties:false`);
zod parsing is lenient (strips unknown keys) so stray model noise never hard-fails.

## Conventions

- **Naming**: `verb_scope_object`, lower_snake_case, ≥1 underscore
  (`get_my_profile`, `list_admin_users`). Enforced by the checker.
- **Unique**: `name` and `auditLabel` are globally unique.
- **Result envelope**: `execute` returns an `AIToolStructuredResult`
  (`toolGranted` / `toolForbidden` / `toolNotFound` / `toolPartial` from
  `helpers.ts`). Don't return bare objects.
- **Category + triggers**: declared in `TOOL_CLASSIFICATION` (registry.ts). They
  drive the capability map and the heuristic router.
- **Confirmation**: high-impact writes set `confirmation: "required-for-write"`
  and require an explicit `confirmedByUser` flag in their input.

## Playbook

### Add a tool
1. Implement `execute` in a file under `lib/ai/tools/` (return a structured
   result). Define its zod input — inline or add it to `schemas.ts`.
2. Add a `defineTool(...)` entry to `RAW_TOOLS` in `registry.ts`.
3. Add a `TOOL_CLASSIFICATION` entry: `{ category, triggers }`.
4. Run `npm run check:tools`. You do **not** touch runtime.ts, capability-map,
   or the system prompt — those derive automatically.

### Modify a tool
- Edit the impl file and/or its registry entry / classification. Changing the
  zod input automatically updates the provider schema, validation, and summary.

### Deprecate, then delete
1. Add `{ since, replacement }` to `TOOL_DEPRECATIONS`. The tool is hidden from
   the model (provider tools + capability map) but stays resolvable in
   `AI_TOOL_MAP` so historical calls don't error. `replacement` must point at a
   real, non-deprecated tool (the checker verifies this).
2. After a grace window, remove its import, `RAW_TOOLS` entry, classification,
   deprecation entry, and the impl file.
- **Never** hard-delete without the deprecation step (breaks stale calls).

### Merge duplicate tools
- Make the surviving tool a true superset (params + returns), then deprecate the
  other toward it. Update heuristic-router references in `runtime.ts`.

## The gate

`npm run check:tools` (`scripts/check-tool-registry.ts`) fails the build on:
unique names/auditLabels, naming convention, required metadata, valid category,
triggers present, exactly one schema source, resolvable provider schema, full
capability-map coverage, and valid deprecation replacements. Run it (and
`npm run build`) before committing tool changes.

import "server-only"
import { AI_TOOLS_REGISTRY } from "@/lib/ai/tools/registry"
import {
  deriveCapabilityCategories,
  deriveCapabilitySummaryText,
  type CapabilityCategory,
  type CapabilityTool,
} from "@/lib/ai/tools/derive"

// The capability map is now DERIVED from the tool registry (each tool declares
// its category + triggers via TOOL_CLASSIFICATION in registry.ts). This file is
// kept as the stable import path consumers already use; it no longer hand-lists
// tools, so it can never drift from the registry again.
export type { CapabilityCategory, CapabilityTool }

export const AI_CAPABILITY_CATEGORIES: CapabilityCategory[] = deriveCapabilityCategories(AI_TOOLS_REGISTRY)

export function buildCapabilitySummaryText(): string {
  return deriveCapabilitySummaryText(AI_CAPABILITY_CATEGORIES)
}

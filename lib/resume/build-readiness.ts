import type { ResumeJson } from "./types"
import { hasFieldValue, RESUME_FIELD_MAP } from "./form-field-registry"
import { getThemeFieldProfile } from "./theme-field-profiles"

// ── Hard required rules ───────────────────────────────────────────────────────
// These are global (not per-theme). Failing any rule sets canBuild = false.

interface RequiredRule {
  /** At least one of these field IDs must be non-empty (OR logic). */
  ids: string[]
  label: string
  errorMsg: string
}

const REQUIRED_RULES: RequiredRule[] = [
  {
    ids: ["basics.name"],
    label: "姓名",
    errorMsg: "请填写姓名（必填）",
  },
  {
    ids: ["basics.email", "basics.phone"],
    label: "联系方式",
    errorMsg: "请至少填写邮箱或手机号",
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MissingRequiredField {
  label: string
  errorMsg: string
}

export interface MissingRecommendedField {
  id: string
  label: string
}

export interface BuildReadinessReport {
  themeSlug: string
  missingRequiredFields: MissingRequiredField[]
  missingRecommendedFields: MissingRecommendedField[]
  completenessScore: number
  canBuild: boolean
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Checks whether resumeJson is ready to build with the given theme.
 *
 * Can be called from both client (real-time banner) and server (build API).
 * Has no side effects and no I/O.
 */
export function checkResumeBuildReadiness(
  resumeJson: ResumeJson,
  themeSlug: string | null | undefined,
): BuildReadinessReport {
  const slug = themeSlug ?? "default"
  const profile = getThemeFieldProfile(slug)

  // ── Required check (60 pts) ──────────────────────────────────────────────
  const missingRequired: MissingRequiredField[] = []
  let requiredFilled = 0

  for (const rule of REQUIRED_RULES) {
    const satisfied = rule.ids.some((id) => hasFieldValue(resumeJson, id))
    if (satisfied) requiredFilled++
    else missingRequired.push({ label: rule.label, errorMsg: rule.errorMsg })
  }

  const requiredScore = Math.round((requiredFilled / REQUIRED_RULES.length) * 60)

  // ── Recommended check (40 pts) ───────────────────────────────────────────
  const recommended = profile.recommendedFields
  const missingRecommended: MissingRecommendedField[] = []
  let recFilled = 0

  for (const fieldId of recommended) {
    if (hasFieldValue(resumeJson, fieldId)) {
      recFilled++
    } else {
      const def = RESUME_FIELD_MAP.get(fieldId)
      missingRecommended.push({ id: fieldId, label: def?.label ?? fieldId })
    }
  }

  const recScore =
    recommended.length > 0
      ? Math.round((recFilled / recommended.length) * 40)
      : 40

  return {
    themeSlug: slug,
    missingRequiredFields: missingRequired,
    missingRecommendedFields: missingRecommended,
    completenessScore: Math.min(100, requiredScore + recScore),
    canBuild: missingRequired.length === 0,
  }
}

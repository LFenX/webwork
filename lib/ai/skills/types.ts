import "server-only"

// Context passed to a skill's match() to decide whether it applies this turn.
export type SkillContext = {
  // The user's prompt for this turn.
  prompt: string
  // Whether the provider supports tool calling (skills that drive tools need it).
  hasToolAccess: boolean
  // Whether this conversation already has a PDF document config — a strong signal
  // that a PDF workflow is ongoing, so follow-up tweaks ("换个主题但内容不变")
  // still activate the skill even when the prompt itself doesn't mention PDF.
  pdfSessionActive: boolean
}

// Why a skill activated this turn (recorded in the run trace for observability).
export type SkillTriggerReason = "pdf_intent" | "pdf_session_active" | "latex_tool_present"

export type SkillEvaluation = { matched: boolean; reason?: SkillTriggerReason }

// A skill is a versioned, self-contained block of domain expertise (markdown)
// that is injected into the model's system context ONLY when it matches the
// current turn (progressive disclosure). Authored in code, owned by us.
export type AISkill = {
  id: string
  name: string
  version: string
  // One-line human description of when this skill applies (docs/telemetry).
  triggerHint: string
  // Whether the skill applies this turn, and (if so) the reason it triggered.
  evaluate: (ctx: SkillContext) => SkillEvaluation
  // The full guidance, injected verbatim as a system context block.
  body: string
}

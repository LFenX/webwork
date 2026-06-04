import "server-only"
import type { AISkill, SkillContext, SkillTriggerReason } from "@/lib/ai/skills/types"
import { pdfAuthoringSkill } from "@/lib/ai/skills/pdf-authoring-skill"

// Registry of in-code skills. Add future skills (resume, knowledge-notes, …) here.
export const AI_SKILLS: AISkill[] = [pdfAuthoringSkill]

export type ActiveSkill = { skill: AISkill; reason?: SkillTriggerReason }

// Skills that apply to the current turn (progressive disclosure: only matched
// skills are injected, so non-matching turns stay lean). A faulty evaluate()
// must never break the run.
export function selectActiveSkills(ctx: SkillContext): ActiveSkill[] {
  const active: ActiveSkill[] = []
  for (const skill of AI_SKILLS) {
    try {
      const ev = skill.evaluate(ctx)
      if (ev.matched) active.push({ skill, reason: ev.reason })
    } catch {
      // ignore a faulty skill
    }
  }
  return active
}

// The combined skill text to inject as a system context block (empty when none
// match). Each skill is framed so the model treats it as authoritative guidance.
export function buildActiveSkillsBlock(ctx: SkillContext): string {
  const active = selectActiveSkills(ctx)
  if (active.length === 0) return ""
  return active
    .map(({ skill }) => `【技能指引 · ${skill.name}】（适用于本次任务，严格遵守）\n${skill.body}`)
    .join("\n\n")
}

// A compact, serializable description of active skills for the run trace / tool
// metadata — real runtime state, never the model's self-report.
export type ActiveSkillInfo = { id: string; name: string; version: string; triggerReason: SkillTriggerReason | "unknown" }

export function describeActiveSkills(ctx: SkillContext): ActiveSkillInfo[] {
  return selectActiveSkills(ctx).map(({ skill, reason }) => ({
    id: skill.id,
    name: skill.name,
    version: skill.version,
    triggerReason: reason ?? "unknown",
  }))
}

import "server-only"
import type { ResumeJson } from "./types"

// 为用户生成 JSON Resume 骨架，仅包含有实际内容的字段。
// 绝不包含 Richard Hendriks 等示例人物的虚假履历；空字符串字段一律省略。
export function buildDefaultResumeJson(input: {
  displayName?: string | null; email?: string | null;
  bio?: string | null; location?: string | null
}): ResumeJson {
  const name = input.displayName?.trim() || input.email?.trim() || "Your Name"

  const basics: ResumeJson["basics"] = { name }
  if (input.email?.trim()) basics.email = input.email.trim()
  if (input.bio?.trim()) basics.summary = input.bio.trim()
  if (input.location?.trim()) basics.location = { city: input.location.trim() }

  return { basics }
}

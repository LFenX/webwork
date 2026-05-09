import "server-only"

export const GUARDIAN_MEMORY_TYPES = [
  "preference",
  "nickname",
  "sqlHabit",
  "learningGoal",
  "relationship",
  "projectContext",
  "boundary",
  "other",
] as const

export const GUARDIAN_MEMORY_STATUSES = ["active", "candidate", "archived", "rejected"] as const
export const GUARDIAN_MEMORY_SOURCES = ["manual", "guardianChat", "userConfirmed", "system"] as const
export const GUARDIAN_MEMORY_SENSITIVITIES = ["low", "medium", "high"] as const

export type GuardianMemoryType = (typeof GUARDIAN_MEMORY_TYPES)[number]
export type GuardianMemoryStatus = (typeof GUARDIAN_MEMORY_STATUSES)[number]
export type GuardianMemorySource = (typeof GUARDIAN_MEMORY_SOURCES)[number]
export type GuardianMemorySensitivity = (typeof GUARDIAN_MEMORY_SENSITIVITIES)[number]

export type GuardianMemorySafetyResult = {
  allowed: boolean
  sensitivity: GuardianMemorySensitivity
  reason?: string
  suggestedStatus?: GuardianMemoryStatus
}

const HIGH_SENSITIVITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(password|passwd|pwd|passphrase|token|api[_\s-]?key|secret|private[_\s-]?key|access[_\s-]?key)\b/i, reason: "secret_like_content" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i, reason: "private_key" },
  { pattern: /\b(sk-[a-zA-Z0-9_-]{16,}|xox[baprs]-[a-zA-Z0-9-]{16,})\b/i, reason: "api_token" },
  { pattern: /(密码|口令|令牌|密钥|私钥|身份证|护照|银行卡|信用卡)/i, reason: "high_sensitivity_keyword" },
  { pattern: /(诊断|病历|病情|处方|医保|贷款|债务|诉讼|律师|未成年|未成年人)/i, reason: "private_sensitive_domain" },
  { pattern: /(精确地址|家庭住址|住址|门牌号|身份证号)/i, reason: "precise_identity_or_address" },
]

const MEDIUM_SENSITIVITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, reason: "contact_email" },
  { pattern: /(?:\+?\d[\d\s-]{8,}\d)/, reason: "contact_phone" },
  { pattern: /(手机号|电话|邮箱|薪资|工资|收入|离职|跳槽|面试计划)/i, reason: "medium_sensitivity_keyword" },
]

const CODE_OR_LOG_PATTERNS = [
  /```[\s\S]*```/,
  /\b(select|with|insert|update|delete|create|alter|drop|truncate)\b[\s\S]{0,120}\b(from|table|where|join|values)\b/i,
  /\b(error|exception|traceback|stack trace|at\s+\w+\.)\b/i,
  /\b(console\.log|function\s+\w+|class\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=)\b/,
]

export function normalizeMemoryText(value: string, maxLength = 500) {
  return Array.from(
    value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, maxLength).join("")
}

export function evaluateGuardianMemorySafety(content: string): GuardianMemorySafetyResult {
  const normalized = normalizeMemoryText(content)
  if (!normalized) {
    return { allowed: false, sensitivity: "high", reason: "empty_content", suggestedStatus: "rejected" }
  }

  for (const item of HIGH_SENSITIVITY_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { allowed: false, sensitivity: "high", reason: item.reason, suggestedStatus: "rejected" }
    }
  }

  for (const item of MEDIUM_SENSITIVITY_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { allowed: true, sensitivity: "medium", reason: item.reason, suggestedStatus: "candidate" }
    }
  }

  return { allowed: true, sensitivity: "low", suggestedStatus: "active" }
}

export function hasExplicitRememberIntent(message: string) {
  return /(请记住|帮我记住|记住我|记住：|记住:|以后叫我|我喜欢|我更喜欢|我正在学习|我的目标是)/i.test(message)
}

export function shouldSkipAutomaticMemoryCandidate(message: string) {
  if (hasExplicitRememberIntent(message)) return false
  return CODE_OR_LOG_PATTERNS.some((pattern) => pattern.test(message))
}

export function inferGuardianMemoryType(content: string): GuardianMemoryType {
  if (/(以后叫我|叫我|称呼|昵称)/i.test(content)) return "nickname"
  if (/(我喜欢|我更喜欢|偏好|更偏向|习惯)/i.test(content)) return "preference"
  if (/(SQL|PostgreSQL|join|查询|表结构|索引)/i.test(content)) return "sqlHabit"
  if (/(正在学习|学习|目标是|想学|计划掌握)/i.test(content)) return "learningGoal"
  if (/(项目|project|产品|应用|系统)/i.test(content)) return "projectContext"
  if (/(不要|别|禁止|边界|不希望)/i.test(content)) return "boundary"
  if (/(朋友|同事|家人|关系)/i.test(content)) return "relationship"
  return "other"
}

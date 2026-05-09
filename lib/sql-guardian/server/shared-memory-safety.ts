import "server-only"

export const GUARDIAN_MEMORY_BRIDGE_DIRECTIONS = [
  "soulwing_to_guardian",
  "guardian_to_soulwing",
] as const

export const GUARDIAN_MEMORY_BRIDGE_STATUSES = ["active", "revoked"] as const

export const GUARDIAN_MEMORY_BRIDGE_SHARED_TYPES = [
  "nickname",
  "communicationPreference",
  "learningGoal",
  "sqlPreference",
  "projectContext",
  "boundary",
  "safePreference",
] as const

export type GuardianMemoryBridgeDirection = (typeof GUARDIAN_MEMORY_BRIDGE_DIRECTIONS)[number]
export type GuardianMemoryBridgeStatus = (typeof GUARDIAN_MEMORY_BRIDGE_STATUSES)[number]
export type GuardianMemoryBridgeSharedType = (typeof GUARDIAN_MEMORY_BRIDGE_SHARED_TYPES)[number]

export type SharedMemorySafetyResult = {
  allowed: boolean
  sensitivity: "low" | "medium" | "high"
  reason?: string
}

const HIGH_SENSITIVITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(password|passwd|pwd|passphrase|token|api[_\s-]?key|secret|private[_\s-]?key|access[_\s-]?key)\b/i, reason: "secret_like_content" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i, reason: "private_key" },
  { pattern: /\b(sk-[a-zA-Z0-9_-]{16,}|xox[baprs]-[a-zA-Z0-9-]{16,})\b/i, reason: "api_token" },
  { pattern: /(密码|口令|令牌|密钥|私钥|身份证|护照|银行卡|信用卡)/i, reason: "identity_or_secret_keyword" },
  { pattern: /(诊断|病历|病情|处方|医保|贷款|债务|诉讼|律师|未成年|未成年人)/i, reason: "private_sensitive_domain" },
  { pattern: /(精确地址|家庭住址|住址|门牌号|身份证号|护照号)/i, reason: "precise_identity_or_address" },
  { pattern: /\b(?:\d[ -]*?){13,19}\b/, reason: "long_numeric_identifier" },
]

const MEDIUM_SENSITIVITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, reason: "contact_email" },
  { pattern: /(?:\+?\d[\d\s-]{8,}\d)/, reason: "contact_phone" },
  { pattern: /(手机号|电话|邮箱|薪资|工资|收入|离职|跳槽|面试计划)/i, reason: "medium_sensitivity_keyword" },
]

function normalizeText(value: string, maxLength = 500) {
  return Array.from(
    value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, maxLength).join("")
}

function compactForCompare(value: string) {
  return normalizeText(value, 2_000)
    .toLowerCase()
    .replace(/[\s"'`“”‘’.,，。:：;；!?！？()[\]{}<>《》、|/\\_-]+/g, "")
}

function bigrams(value: string) {
  const chars = Array.from(value)
  const result = new Set<string>()
  for (let index = 0; index < chars.length - 1; index += 1) {
    result.add(`${chars[index]}${chars[index + 1]}`)
  }
  return result
}

export function normalizeSharedSummary(value: string) {
  return normalizeText(value, 300)
}

export function checkSharedMemoryTextSafety(content: string): SharedMemorySafetyResult {
  const normalized = normalizeText(content)
  if (!normalized) return { allowed: false, sensitivity: "high", reason: "empty_content" }

  for (const item of HIGH_SENSITIVITY_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { allowed: false, sensitivity: "high", reason: item.reason }
    }
  }

  for (const item of MEDIUM_SENSITIVITY_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { allowed: false, sensitivity: "medium", reason: item.reason }
    }
  }

  return { allowed: true, sensitivity: "low" }
}

export function checkSharedMemorySummarySafety(summary: string) {
  return checkSharedMemoryTextSafety(summary)
}

export function checkSourceMemoryShareSafety(content: string) {
  return checkSharedMemoryTextSafety(content)
}

export function isLikelyRawMemoryCopy(summary: string, sourceContent: string) {
  const compactSummary = compactForCompare(summary)
  const compactSource = compactForCompare(sourceContent)
  if (!compactSummary || !compactSource) return false
  if (compactSummary === compactSource) return true
  if (compactSummary.length >= 80 && compactSource.includes(compactSummary)) {
    return compactSummary.length / compactSource.length >= 0.68
  }
  if (compactSummary.length < 40 || compactSource.length < 40) return false

  const summaryBigrams = bigrams(compactSummary)
  const sourceBigrams = bigrams(compactSource)
  if (!summaryBigrams.size || !sourceBigrams.size) return false

  let overlap = 0
  for (const item of summaryBigrams) {
    if (sourceBigrams.has(item)) overlap += 1
  }
  return overlap / summaryBigrams.size > 0.92 && compactSummary.length / compactSource.length > 0.55
}

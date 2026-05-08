export const LEVEL_THRESHOLDS = [
  0,
  40,
  120,
  260,
  520,
  900,
  1400,
  2100,
] as const

const LEVEL_TITLES = [
  "迷失的数据水手",
  "查询港口见习守门人",
  "SQL 航线绘图师",
  "表结构潮汐观察员",
  "数据风暴穿越者",
  "索引罗盘掌舵者",
  "星海查询守门人",
  "深空数据航海士",
] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getGuardianLevelFromExp(exp: number): number {
  const safeExp = Math.max(0, Math.floor(exp))
  let level = 1

  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (safeExp >= LEVEL_THRESHOLDS[index]) level = index + 1
  }

  return level
}

export function getGuardianFormStage(level: number): string {
  if (level >= 7) return "guardian"
  if (level >= 5) return "navigator"
  if (level >= 3) return "sailor"
  return "seed"
}

export function getGuardianTitle(level: number): string {
  const index = clamp(Math.floor(level), 1, LEVEL_TITLES.length) - 1
  return LEVEL_TITLES[index]
}

export function getNextLevelExp(level: number): number {
  const next = LEVEL_THRESHOLDS[level]
  return next ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
}

export function getExpProgress(exp: number) {
  const level = getGuardianLevelFromExp(exp)
  const currentLevelExp = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextLevelExp = getNextLevelExp(level)
  const span = Math.max(1, nextLevelExp - currentLevelExp)
  const progress = level >= LEVEL_THRESHOLDS.length
    ? 1
    : clamp((Math.max(0, exp) - currentLevelExp) / span, 0, 1)

  return {
    level,
    currentLevelExp,
    nextLevelExp,
    progress,
  }
}

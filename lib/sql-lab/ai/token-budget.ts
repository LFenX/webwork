export function clampText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(0, maxChars - 40))}\n...（已按 token 预算截断）`
}

export function clampMarkdownSections(sections: string[], maxChars = 48_000) {
  const out: string[] = []
  let used = 0
  for (const section of sections) {
    const remaining = maxChars - used
    if (remaining <= 0) break
    const next = clampText(section, remaining)
    out.push(next)
    used += next.length
  }
  return out.join("\n\n")
}

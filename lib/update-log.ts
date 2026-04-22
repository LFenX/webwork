import "server-only"
import { execFileSync } from "node:child_process"
import { prisma } from "@/lib/db"

export type UpdateLogItem = {
  hash: string
  date: string
  message: string
  originalMessage: string
  customMessage?: string | null
  useOriginal?: boolean
  hidden?: boolean
}

export function getUpdateLog(limit = 80): UpdateLogItem[] {
  try {
    const output = execFileSync("git", [
      "log",
      `--max-count=${limit}`,
      "--date=iso-strict",
      "--pretty=format:%H%x1f%ad%x1f%s%x1e",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })

    return output
      .split("\x1e")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [hash, date, message] = entry.split("\x1f")
        return {
          hash,
          date,
          message: message || "更新",
          originalMessage: message || "更新",
        }
      })
  } catch {
    return []
  }
}

export async function getEditableUpdateLog(limit = 80): Promise<UpdateLogItem[]> {
  const original = getUpdateLog(limit)
  if (original.length === 0) return []

  const overrides = await prisma.updateLogOverride.findMany({
    where: { hash: { in: original.map((item) => item.hash) } },
  })
  const overrideMap = new Map(overrides.map((item) => [item.hash, item]))

  return original.map((item) => {
    const override = overrideMap.get(item.hash)
    const useOriginal = override?.useOriginal ?? true
    return {
      ...item,
      originalMessage: item.originalMessage,
      customMessage: override?.customMessage ?? null,
      useOriginal,
      hidden: override?.hidden ?? false,
      message: useOriginal ? item.originalMessage : (override?.customMessage || item.originalMessage),
    }
  })
}

export async function getPublicUpdateLog(limit = 80): Promise<UpdateLogItem[]> {
  const items = await getEditableUpdateLog(limit)
  return items.filter((item) => !item.hidden)
}

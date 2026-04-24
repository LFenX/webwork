import "server-only"
import { prisma } from "@/lib/db"

export async function resolveUserReference(reference: string | null | undefined) {
  const value = reference?.trim()
  if (!value) return null

  const exact = await prisma.user.findFirst({
    where: {
      OR: [{ id: value }, { email: value.toLowerCase() }],
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarText: true,
      avatarUrl: true,
    },
  })
  if (exact) return exact

  const fuzzy = await prisma.user.findFirst({
    where: {
      OR: [
        { displayName: { contains: value, mode: "insensitive" } },
        { email: { contains: value.toLowerCase(), mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarText: true,
      avatarUrl: true,
    },
  })

  return fuzzy
}

export function previewText(value: string, size = 80) {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= size) return text
  return `${text.slice(0, size)}...`
}

export function summarizeGeoLocation(value: string) {
  if (!value) return ""
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 2) return parts.join(" / ")
  return parts.slice(0, 2).join(" / ")
}

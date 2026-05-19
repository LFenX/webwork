import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"

export async function getPublicUserRefs(userId: string, extraRefs: Array<string | null | undefined> = []) {
  const refs = new Set<string>([userId])
  for (const ref of extraRefs) {
    if (ref) refs.add(ref)
  }

  const rows = await prisma.$queryRaw<Array<{ publicSlug: string | null }>>`
    SELECT "publicSlug"
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `
  const publicSlug = rows[0]?.publicSlug
  if (publicSlug) refs.add(publicSlug)
  return [...refs]
}

export function revalidatePublicUserRefs(refs: string[], suffixes: string[] = [""]) {
  for (const ref of refs) {
    for (const suffix of suffixes) {
      const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+/, "")}` : ""
      revalidatePath(`/u/${ref}${normalizedSuffix}`)
    }
    revalidatePath(`/u/${ref}`, "layout")
  }
}

export async function revalidatePublicUserPaths(
  userId: string,
  suffixes: string[] = [""],
  extraRefs: Array<string | null | undefined> = []
) {
  const refs = await getPublicUserRefs(userId, extraRefs)
  revalidatePublicUserRefs(refs, suffixes)
}

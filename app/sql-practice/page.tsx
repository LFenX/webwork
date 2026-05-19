import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getSqlPracticeAccess } from "@/lib/sql-practice/access"
import { SqlPracticeClient } from "./sql-practice-client"

export const metadata = { title: "SQL 练题 — My Space" }
export const dynamic = "force-dynamic"

export default async function SqlPracticePage() {
  await requireAuth()
  const access = await getSqlPracticeAccess()
  if (!access || !access.canAccess) {
    redirect("/")
  }
  return <SqlPracticeClient isOwner={access.isOwner} />
}

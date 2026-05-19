import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getSqlPracticeAccess } from "@/lib/sql-practice/access"
import { SqlPracticeGrantsClient } from "./grants-client"

export const metadata = { title: "SQL 练题授权 — My Space" }
export const dynamic = "force-dynamic"

export default async function SqlPracticeAdminPage() {
  await requireAuth()
  const access = await getSqlPracticeAccess()
  if (!access || !access.isOwner) {
    redirect("/")
  }
  return <SqlPracticeGrantsClient />
}

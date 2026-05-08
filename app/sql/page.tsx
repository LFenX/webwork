import { requireAuth } from "@/lib/auth"
import { SqlLabClient } from "./sql-lab-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function SqlLabPage() {
  await requireAuth()
  return <SqlLabClient />
}

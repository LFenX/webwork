import { redirect } from "next/navigation"
import { getCurrentAdmin } from "@/lib/admin"
import { AdminClient } from "./admin-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function AdminPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect("/")
  return <AdminClient />
}

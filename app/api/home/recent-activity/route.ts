import { getOptionalSession } from "@/lib/auth"
import { getRecentActivityHub } from "@/lib/recent-activity"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getOptionalSession()
  if (!session) return Response.json({ groups: [] }, { status: 401 })
  const groups = await getRecentActivityHub(session.userId)
  return Response.json({ groups })
}

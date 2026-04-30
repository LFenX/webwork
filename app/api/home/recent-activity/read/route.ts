import { getOptionalSession } from "@/lib/auth"
import { markRecentActivitiesRead } from "@/lib/recent-activity-reads"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await getOptionalSession()
  if (!session) return Response.json({ ok: false }, { status: 401 })
  const body = await req.json().catch((): unknown => ({}))
  const rawActivityIds = typeof body === "object" && body !== null && "activityIds" in body
    ? (body as { activityIds?: unknown }).activityIds
    : null
  const activityIds = Array.isArray(rawActivityIds) ? rawActivityIds.filter((id): id is string => typeof id === "string") : []
  const updated = await markRecentActivitiesRead(session.userId, activityIds)
  return Response.json({ ok: true, updated })
}

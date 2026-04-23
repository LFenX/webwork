import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createAIAccessRequest, getMyAIAccessRequest } from "@/lib/ai/service"
import { aiAccessRequestSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const request = await getMyAIAccessRequest(session.userId)
  return NextResponse.json({
    request: request
      ? {
          id: request.id,
          status: request.status,
          message: request.message,
          reviewNote: request.reviewNote,
          createdAt: request.createdAt.toISOString(),
          reviewedAt: request.reviewedAt?.toISOString() ?? null,
        }
      : null,
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiAccessRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  const created = await createAIAccessRequest(session.userId, parsed.data)
  return NextResponse.json({
    request: {
      id: created.id,
      status: created.status,
      message: created.message,
      createdAt: created.createdAt.toISOString(),
    },
  }, { status: 201, headers: NO_STORE })
}

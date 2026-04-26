import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { cancelAIAccessRequest, createAIAccessRequest, getMyAIAccessRequest } from "@/lib/ai/service"
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

export async function DELETE() {
  const session = await requireAuth()
  try {
    const updated = await cancelAIAccessRequest(session.userId)
    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
      },
    }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    return NextResponse.json({ error: message }, { status: message === "NOT_FOUND" ? 404 : 503, headers: NO_STORE })
  }
}

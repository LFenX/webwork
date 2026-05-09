import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  getGuardianChatRateLimitFallback,
  runGuardianChat,
} from "@/lib/sql-guardian/server/chat-service"
import {
  GuardianServiceError,
  getOrCreateGuardianProfile,
  serializeGuardianProfileResponse,
} from "@/lib/sql-guardian/server/profile-service"
import { guardianChatSchema } from "@/lib/sql-guardian/server/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

async function jsonError(error: unknown, userId?: string) {
  if (error instanceof GuardianServiceError) {
    if (error.status === 429 && userId) {
      const profile = await getOrCreateGuardianProfile(userId)
      return NextResponse.json({
        error: error.message,
        code: error.code,
        reply: getGuardianChatRateLimitFallback(),
        dialogue: null,
        ...serializeGuardianProfileResponse(profile),
        fallback: true,
        fallbackReason: "rate-limited",
      }, { status: 429, headers: NO_STORE })
    }

    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE })
  }

  const message = error instanceof Error ? error.message : "Unexpected Guardian chat error"
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = guardianChatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await runGuardianChat(session.userId, parsed.data)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error, session.userId)
  }
}

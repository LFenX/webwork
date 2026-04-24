import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { recordActivity } from "@/lib/admin"
import { passwordChangeRequestSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const request = await prisma.passwordChangeRequest.findFirst({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
    select: { id: true, status: true, requestedAt: true, respondedAt: true },
  })

  return NextResponse.json({ request }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const body = await req.json().catch(() => null)
  const parsed = passwordChangeRequestSchema.safeParse(body)

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const message =
      fieldErrors.confirmPassword?.[0] ??
      fieldErrors.password?.[0] ??
      "Invalid password change request"
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE })
  }

  const user = session
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true } })
    : parsed.data.email
      ? await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true } })
      : null

  if (!user) {
    return NextResponse.json({ error: session ? "User not found" : "Please provide a registered email address" }, { status: 404, headers: NO_STORE })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  await prisma.passwordChangeRequest.updateMany({
    where: { userId: user.id, status: "pending" },
    data: { status: "superseded", respondedAt: new Date() },
  })
  const request = await prisma.passwordChangeRequest.create({
    data: { userId: user.id, passwordHash },
    select: { id: true, status: true, requestedAt: true },
  })

  await recordActivity(user.id, "request_password_change", "Submitted password change request", req)
  return NextResponse.json({ request }, { status: 202, headers: NO_STORE })
}

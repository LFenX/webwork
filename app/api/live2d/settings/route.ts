import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import {
  BUBBLE_NAME_MAX_LENGTH,
  BUBBLE_THEME_IDS,
  getUserLive2DSettings,
  LIVE2D_DEFAULTS,
} from "@/lib/live2d-settings"
import { isValidModelId } from "@/lib/live2d-models"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const live2dSettingsSchema = z.object({
  displayMode: z.enum(["off", "desktop", "all"]).optional(),
  position: z.enum(["left-bottom", "right-bottom"]).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  drag: z.boolean().optional(),
  modelId: z.string().refine(isValidModelId, { message: "Unknown model" }).optional(),
  bubbleTheme: z.enum(BUBBLE_THEME_IDS as [string, ...string[]]).optional(),
  bubbleName: z.string().max(BUBBLE_NAME_MAX_LENGTH).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })
  const settings = await getUserLive2DSettings(session.userId)
  return NextResponse.json(settings, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = live2dSettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })

  const data = parsed.data
  await prisma.live2DSettings.upsert({
    where: { userId: session.userId },
    update: {
      ...(data.displayMode !== undefined ? { displayMode: data.displayMode } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      ...(data.size !== undefined ? { size: data.size } : {}),
      ...(data.drag !== undefined ? { drag: data.drag } : {}),
      ...(data.modelId !== undefined ? { modelId: data.modelId } : {}),
      ...(data.bubbleTheme !== undefined ? { bubbleTheme: data.bubbleTheme } : {}),
      ...(data.bubbleName !== undefined ? { bubbleName: data.bubbleName } : {}),
    },
    create: {
      userId: session.userId,
      displayMode: data.displayMode ?? LIVE2D_DEFAULTS.displayMode,
      position: data.position ?? LIVE2D_DEFAULTS.position,
      size: data.size ?? LIVE2D_DEFAULTS.size,
      drag: data.drag ?? LIVE2D_DEFAULTS.drag,
      modelId: data.modelId ?? LIVE2D_DEFAULTS.modelId,
      bubbleTheme: data.bubbleTheme ?? LIVE2D_DEFAULTS.bubbleTheme,
      bubbleName: data.bubbleName ?? LIVE2D_DEFAULTS.bubbleName,
    },
  })

  return NextResponse.json({ success: true }, { headers: NO_STORE })
}

import "server-only"

import { prisma } from "@/lib/db"
import { DEFAULT_MODEL_ID, isValidModelId } from "@/lib/live2d-models"
import {
  LIVE2D_DEFAULTS,
  normalizeBubbleName,
  normalizeBubbleTheme,
  normalizeDisplayMode,
  normalizePosition,
  normalizeSize,
  type UserLive2DSettings,
} from "@/lib/live2d-shared"

// Re-export the shared surface so existing server-side imports keep working.
// Client components must import from `@/lib/live2d-shared` directly — this
// file pulls in Prisma and is guarded by `server-only`.
export {
  BUBBLE_NAME_MAX_LENGTH,
  BUBBLE_THEME_IDS,
  DEFAULT_BUBBLE_THEME,
  LIVE2D_DEFAULTS,
} from "@/lib/live2d-shared"
export type {
  Live2DBubbleTheme,
  Live2DDisplayMode,
  Live2DPosition,
  Live2DSize,
  UserLive2DSettings,
} from "@/lib/live2d-shared"

export async function getUserLive2DSettings(userId: string | null | undefined): Promise<UserLive2DSettings> {
  if (!userId) return LIVE2D_DEFAULTS
  try {
    const row = await prisma.live2DSettings.findUnique({ where: { userId } })
    if (!row) return LIVE2D_DEFAULTS
    return {
      displayMode: normalizeDisplayMode(row.displayMode),
      position: normalizePosition(row.position),
      size: normalizeSize(row.size),
      drag: row.drag,
      modelId: isValidModelId(row.modelId) ? row.modelId : DEFAULT_MODEL_ID,
      bubbleTheme: normalizeBubbleTheme(row.bubbleTheme),
      bubbleName: normalizeBubbleName(row.bubbleName),
    }
  } catch {
    return LIVE2D_DEFAULTS
  }
}

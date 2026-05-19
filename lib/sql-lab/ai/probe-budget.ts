import "server-only"

import { prisma } from "@/lib/db"

export const PROBE_BUDGET = {
  maxPerCall: 8,
  maxPerThread: 20,
  maxRowsPerProbe: 100,
  maxDurationMsPerProbe: 5000,
} as const

export async function countThreadProbes(userId: string, threadId: string) {
  return prisma.sqlThreadStep.count({
    where: {
      userId,
      threadId,
      kind: "ai_probe_sql",
    },
  })
}

export async function canRunProbe(input: { userId: string; threadId: string; probesThisCall: number }) {
  if (input.probesThisCall >= PROBE_BUDGET.maxPerCall) {
    return { ok: false, reason: `单次分析最多允许 ${PROBE_BUDGET.maxPerCall} 次自主探查。` }
  }
  const used = await countThreadProbes(input.userId, input.threadId)
  if (used >= PROBE_BUDGET.maxPerThread) {
    return { ok: false, reason: `当前线程累计自主探查已达到 ${PROBE_BUDGET.maxPerThread} 次上限。` }
  }
  return { ok: true, remainingThread: PROBE_BUDGET.maxPerThread - used, remainingCall: PROBE_BUDGET.maxPerCall - input.probesThisCall }
}

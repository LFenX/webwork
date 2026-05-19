import { JOB_PIPELINE_STAGES } from "@/lib/enums"

export const NO_REPLY_ABANDON_STATUS = "无回复放弃"
export const REPLIED_ABANDON_STATUS = "已放弃"

export const JOB_TERMINAL_STATUSES = new Set([
  "未通过评估",
  "未通过面试",
  "已拒绝",
  REPLIED_ABANDON_STATUS,
  NO_REPLY_ABANDON_STATUS,
  "已接受",
])

export const JOB_INTERVIEW_STATUSES = new Set(["进入面试", "未通过面试", "已Offer", "已接受"])
export const JOB_OFFER_STATUSES = new Set(["已Offer", "已接受"])

const JOB_REPLIED_STATUSES = new Set([
  "已回复",
  "未通过评估",
  "进入面试",
  "未通过面试",
  "已拒绝",
  "已Offer",
  "已接受",
])

export const JOB_MIN_STAGE_BY_STATUS: Record<string, number> = {
  未通过评估: 1,
  进入面试: 3,
  未通过面试: 3,
  已Offer: 4,
  已接受: 5,
}

export type JobReplySignal = {
  status: string
  repliedAt?: Date | string | null
  pipelineStage?: number | null
}

export function hasJobReplySignal(job: JobReplySignal) {
  if (job.status === "已投递" || job.status === NO_REPLY_ABANDON_STATUS) return false
  if (JOB_REPLIED_STATUSES.has(job.status)) return true
  if (job.status === REPLIED_ABANDON_STATUS) return Boolean(job.repliedAt) || (job.pipelineStage ?? 0) > 0
  return Boolean(job.repliedAt) || (job.pipelineStage ?? 0) > 0
}

export function getJobReachedStage(job: { status: string; pipelineStage: number | null }) {
  const recordedStage = Math.min(Math.max(job.pipelineStage ?? 0, 0), JOB_PIPELINE_STAGES.length - 1)
  return Math.max(recordedStage, JOB_MIN_STAGE_BY_STATUS[job.status] ?? 0)
}

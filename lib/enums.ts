export const JOB_STATUS = [
  "已投递",
  "已回复",
  "进入面试",
  "已拒绝",
  "已Offer",
  "已接受",
  "已放弃",
] as const
export type JobStatus = (typeof JOB_STATUS)[number]

export const JOB_CHANNELS = [
  "Boss直聘",
  "拉勾",
  "官网",
  "内推",
  "猎头",
  "LinkedIn",
  "其他",
] as const
export type JobChannel = (typeof JOB_CHANNELS)[number]

export const INTERVIEW_ROUNDS = [
  "HR初筛",
  "技术一面",
  "技术二面",
  "交叉面",
  "Leader面",
  "HRBP",
  "终面",
] as const
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number]

export const INTERVIEW_FORMATS = ["电话", "视频", "现场", "笔试"] as const
export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number]

export const INTERVIEW_RESULTS = ["待定", "通过", "未通过"] as const
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number]

export const JOB_STATUS_COLORS: Record<string, string> = {
  已投递: "bg-[--color-bg-hover] text-[--color-text-secondary]",
  已回复: "bg-[--color-warning-bg] text-[--color-warning]",
  进入面试: "bg-blue-50 text-blue-700",
  已拒绝: "bg-[--color-danger-bg] text-[--color-danger]",
  已Offer: "bg-[--color-success-bg] text-[--color-success]",
  已接受: "bg-[--color-success-bg] text-[--color-success]",
  已放弃: "bg-[--color-bg-hover] text-[--color-text-muted]",
}

export const INTERVIEW_RESULT_COLORS: Record<string, string> = {
  待定: "bg-[--color-warning-bg] text-[--color-warning]",
  通过: "bg-[--color-success-bg] text-[--color-success]",
  未通过: "bg-[--color-danger-bg] text-[--color-danger]",
}

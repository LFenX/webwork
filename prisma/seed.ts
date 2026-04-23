import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL env var is required for PostgreSQL")
}

const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // Seed requires an existing user — find the first user or skip
  const user = await prisma.user.findFirst()
  if (!user) {
    console.log("No users found. Create a user or run the SQLite to PostgreSQL migration first.")
    return
  }
  const userId = user.id

  await prisma.interviewRecord.deleteMany({ where: { userId } })
  await prisma.jobApplication.deleteMany({ where: { userId } })

  const job1 = await prisma.jobApplication.create({
    data: {
      userId,
      company: "字节跳动",
      position: "前端工程师",
      channel: "Boss直聘",
      appliedAt: new Date("2026-03-10"),
      status: "进入面试",
      notes: "日常推荐",
    },
  })

  const job2 = await prisma.jobApplication.create({
    data: {
      userId,
      company: "阿里巴巴",
      position: "React 开发工程师",
      channel: "官网",
      appliedAt: new Date("2026-03-15"),
      status: "已回复",
      repliedAt: new Date("2026-03-18"),
    },
  })

  await prisma.jobApplication.create({
    data: {
      userId,
      company: "腾讯",
      position: "高级前端工程师",
      channel: "内推",
      appliedAt: new Date("2026-03-20"),
      status: "已拒绝",
      repliedAt: new Date("2026-03-25"),
    },
  })

  await prisma.jobApplication.create({
    data: {
      userId,
      company: "美团",
      position: "全栈工程师",
      channel: "拉勾",
      appliedAt: new Date("2026-04-01"),
      status: "已投递",
    },
  })

  await prisma.jobApplication.create({
    data: {
      userId,
      company: "网易",
      position: "前端开发",
      channel: "Boss直聘",
      appliedAt: new Date("2026-04-05"),
      status: "已投递",
    },
  })

  await prisma.interviewRecord.create({
    data: {
      userId,
      jobId: job1.id,
      company: "字节跳动",
      position: "前端工程师",
      round: "技术一面",
      format: "视频",
      scheduledAt: new Date("2026-03-20T10:00:00"),
      interviewers: "张工",
      questions: "## 问题\n- React Hooks 原理\n- 虚拟 DOM diff 算法\n- 手写防抖节流",
      selfRating: 4,
      result: "通过",
      feedback: "整体表现不错，算法题解题思路清晰",
    },
  })

  await prisma.interviewRecord.create({
    data: {
      userId,
      jobId: job1.id,
      company: "字节跳动",
      position: "前端工程师",
      round: "技术二面",
      format: "视频",
      scheduledAt: new Date("2026-04-01T14:00:00"),
      interviewers: "李总监",
      questions: "## 问题\n- 项目架构设计\n- 性能优化经验\n- 系统设计题",
      selfRating: 3,
      result: "待定",
    },
  })

  await prisma.interviewRecord.create({
    data: {
      userId,
      jobId: job2.id,
      company: "阿里巴巴",
      position: "React 开发工程师",
      round: "HR初筛",
      format: "电话",
      scheduledAt: new Date("2026-03-19T09:30:00"),
      interviewers: "HR王丽",
      questions: "薪资期望、在职状态、期望入职时间",
      selfRating: 5,
      result: "通过",
    },
  })

  console.log("Seed completed!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

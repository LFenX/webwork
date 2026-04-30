import "dotenv/config"
import { prisma } from "../lib/db"

async function check() {
  const count = await prisma.resumeTemplateConfig.count()
  console.log("ResumeTemplateConfig rows:", count)

  const rows = await prisma.resumeTemplateConfig.findMany({
    select: { slug: true, category: true, sortOrder: true, enabled: true },
  })
  console.log("Existing configs:", JSON.stringify(rows, null, 2))

  const zhCount = rows.filter((r) => r.category === "zh").length
  const enCount = rows.filter((r) => r.category === "en").length
  console.log("zh category:", zhCount)
  console.log("en category:", enCount)

  await prisma.$disconnect()
}

check().catch((e) => {
  console.error(e)
  process.exit(1)
})

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import path from "path"
import fs from "fs"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400 })
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  const destPath = path.join(uploadsDir, "resume.pdf")
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(destPath, buffer)

  const pdfPath = "/uploads/resume.pdf"
  await prisma.resume.upsert({
    where: { id: "singleton" },
    update: { mode: "pdf", pdfPath },
    create: { id: "singleton", mode: "pdf", pdfPath },
  })
  revalidatePath("/resume")
  return NextResponse.json({ ok: true, pdfPath }, { headers: NO_STORE })
}

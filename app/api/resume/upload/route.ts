import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import path from "path"
import { mkdir, writeFile } from "fs/promises"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

function cleanVersionName(value: FormDataEntryValue | null) {
  const name = typeof value === "string" ? value.trim() : ""
  return name.slice(0, 60)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const name = cleanVersionName(formData.get("name"))
  if (!name) return NextResponse.json({ error: "请填写版本名" }, { status: 400, headers: NO_STORE })
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400, headers: NO_STORE })
  }

  const versionId = crypto.randomUUID()
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "resumes", session.userId)
  await mkdir(uploadsDir, { recursive: true })

  const destPath = path.join(uploadsDir, `${versionId}.pdf`)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(destPath, buffer)

  const pdfPath = `/uploads/resumes/${session.userId}/${versionId}.pdf`
  const version = await prisma.resumeVersion.create({
    data: {
      id: versionId,
      userId: session.userId,
      name,
      pdfPath,
      originalName: file.name,
      size: file.size,
    },
  })
  const resume = await prisma.resume.upsert({
    where: { userId: session.userId },
    update: { mode: "pdf", pdfPath },
    create: { userId: session.userId, mode: "pdf", pdfPath },
  })

  revalidatePath("/resume")
  revalidatePath("/resume/edit")
  return NextResponse.json({ ok: true, version, resume }, { headers: NO_STORE })
}

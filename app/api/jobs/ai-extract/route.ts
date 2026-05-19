import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { requestProviderChat } from "@/lib/ai/provider"
import { JOB_CHANNELS } from "@/lib/enums"
import { ALLOWED_MIME, MAX_UPLOAD_SIZE } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

type ExtractedJob = {
  company?: string | null
  position?: string | null
  channel?: string | null
  baseLocation?: string | null
  salaryRange?: string | null
  jobDescription?: string | null
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim()
}

function pickJsonBlock(text: string): string {
  const cleaned = stripCodeFence(text)
  const first = cleaned.indexOf("{")
  const last = cleaned.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) return cleaned.slice(first, last + 1)
  return cleaned
}

function normalizeChannel(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = (JOB_CHANNELS as readonly string[]).find((c) => c === trimmed || trimmed.includes(c) || c.includes(trimmed))
  return match ?? trimmed
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const provider = await getEffectiveProviderConfig(session.userId).catch(() => null)
  if (!provider) {
    return NextResponse.json({ error: "no_ai", message: "未配置可用的 AI 模型" }, { status: 400, headers: NO_STORE })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400, headers: NO_STORE })
  }
  if (!ALLOWED_MIME.has(file.type) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "invalid_mime" }, { status: 400, headers: NO_STORE })
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "too_large" }, { status: 413, headers: NO_STORE })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`

  const channelHint = JOB_CHANNELS.join(" / ")

  try {
    const result = await requestProviderChat({
      provider,
      stream: false,
      timeoutMs: 60_000,
      messages: [
        {
          role: "system",
          content: [
            "你是招聘岗位识别助手。用户会提供一张岗位截图（来自招聘网站、邮件、HR 朋友圈等）。",
            "请抽取关键信息，仅输出 JSON 对象，禁止任何 Markdown、注释或解释。",
            "JSON schema：",
            "{",
            '  "company": string|null,           // 公司全称或简称',
            '  "position": string|null,          // 职位名称',
            `  "channel": string|null,           // 求职渠道，从如下枚举择一：${channelHint}；找不到合适项返回 null`,
            '  "baseLocation": string|null,     // 工作地点，例如"北京"、"上海·徐汇"、"远程"',
            '  "salaryRange": string|null,      // 薪资范围原文，例如"25-35K · 14薪"',
            '  "jobDescription": string|null    // 岗位职责 + 任职要求的完整文本，保留换行；若图中无 JD 留 null',
            "}",
            "对没有把握的字段返回 null。所有字符串使用图中原文（中文 / 英文 / 数字保持原样）。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            { type: "text", text: "请识别这张岗位截图并按 schema 返回 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    })

    const raw = pickJsonBlock(result.assistantText || "")
    let parsed: Record<string, unknown>
    try {
      const value = JSON.parse(raw)
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not object")
      parsed = value as Record<string, unknown>
    } catch {
      return NextResponse.json({
        error: "parse_failed",
        message: "AI 没有返回合法 JSON",
        rawText: result.assistantText?.slice(0, 600) ?? "",
      }, { status: 502, headers: NO_STORE })
    }

    const extracted: ExtractedJob = {
      company: typeof parsed.company === "string" ? parsed.company.trim() || null : null,
      position: typeof parsed.position === "string" ? parsed.position.trim() || null : null,
      channel: normalizeChannel(parsed.channel),
      baseLocation: typeof parsed.baseLocation === "string" ? parsed.baseLocation.trim() || null : null,
      salaryRange: typeof parsed.salaryRange === "string" ? parsed.salaryRange.trim() || null : null,
      jobDescription: typeof parsed.jobDescription === "string" ? parsed.jobDescription.trim() || null : null,
    }

    return NextResponse.json({ extracted }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai_failed"
    return NextResponse.json({ error: "ai_failed", message }, { status: 502, headers: NO_STORE })
  }
}

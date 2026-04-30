"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  chatType: "direct" | "group"
  conversationId: string
  onInsertDraft: (text: string) => void
  onSend?: (text: string) => Promise<void>
}

export function SoulWingReplyButton({ chatType, conversationId, onInsertDraft, onSend }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(50)
  const [instruction, setInstruction] = useState("")
  const [mode, setMode] = useState<"draft" | "auto_send">("draft")
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function handleOpen() {
    setOpen(true)
    setPreview(null)
    setInstruction("")
    setMode("draft")
  }

  function handleClose() {
    setOpen(false)
    setPreview(null)
  }

  async function generate() {
    setLoading(true)
    setPreview(null)
    try {
      const res = await fetch("/api/chat/soulwing-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatType, conversationId, limit, instruction: instruction.trim() || undefined, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "生成失败")

      const reply = data.reply as string
      if (mode === "draft") {
        onInsertDraft(reply)
        toast.success("已填入输入框，可编辑后发送")
        handleClose()
      } else {
        setPreview(reply)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成回复失败")
    } finally {
      setLoading(false)
    }
  }

  async function confirmSend() {
    if (!preview || !onSend) return
    setSending(true)
    try {
      await onSend(preview)
      toast.success("消息已发送")
      handleClose()
    } catch {
      toast.error("发送失败")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="让蝶灵帮我回复"
        onClick={handleOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[#ededed] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Image src="/soulwing-icon-24.png" alt="蝶灵" width={20} height={20} className="h-5 w-5" />
      </button>

      {/* Mobile: iOS bottom sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[70]" onClick={handleClose}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-3 flex flex-col gap-2"
            style={{ bottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-[14px] bg-white">
              <div className="border-b border-gray-100 px-4 py-3 text-center">
                <p className="text-[13px] font-medium text-gray-500">蝶灵帮你回复</p>
              </div>
              {!preview ? (
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-[15px] text-gray-800">上下文范围</span>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="rounded-lg border-0 bg-gray-50 px-2 py-1 text-sm text-gray-600 focus:outline-none"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>最近 {n} 条</option>
                      ))}
                    </select>
                  </div>
                  {onSend && (
                    <div className="px-5 py-3.5">
                      <p className="mb-2 text-[15px] text-gray-800">回复方式</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setMode("draft")} className={`flex-1 rounded-full py-2 text-sm font-medium transition ${mode === "draft" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>填入输入框</button>
                        <button type="button" onClick={() => setMode("auto_send")} className={`flex-1 rounded-full py-2 text-sm font-medium transition ${mode === "auto_send" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>预览后发送</button>
                      </div>
                    </div>
                  )}
                  <div className="px-5 py-3.5">
                    <p className="mb-2 text-[15px] text-gray-800">自定义要求<span className="text-gray-400 text-sm">（可选）</span></p>
                    <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="例如：温柔一点、简短一点……" className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <button type="button" onClick={() => void generate()} disabled={loading} className="flex w-full items-center justify-center gap-2 py-4 text-[17px] font-semibold text-blue-600 disabled:opacity-60 active:bg-gray-50">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? "蝶灵生成中…" : "生成回复"}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-5 py-3.5"><p className="text-xs text-amber-600">这条消息会以你的身份发送，请确认后再发送。</p></div>
                  <div className="px-5 py-4"><p className="whitespace-pre-wrap text-[15px] text-gray-800">{preview}</p></div>
                  <button type="button" onClick={() => void confirmSend()} disabled={sending} className="flex w-full items-center justify-center gap-2 py-4 text-[17px] font-semibold text-blue-600 disabled:opacity-60 active:bg-gray-50">
                    {sending && <Loader2 size={16} className="animate-spin" />}
                    {sending ? "发送中…" : "确认发送"}
                  </button>
                  <button type="button" onClick={() => setPreview(null)} className="flex w-full items-center justify-center py-4 text-[15px] text-gray-500 active:bg-gray-50">返回修改</button>
                </div>
              )}
            </div>
            <button type="button" onClick={handleClose} className="w-full rounded-[14px] bg-white py-[17px] text-center text-[17px] font-semibold text-blue-600 active:bg-gray-50">取消</button>
          </div>
        </div>
      )}

      {/* Desktop: small floating popup */}
      {open && (
        <>
          <div className="hidden md:block fixed inset-0 z-[69]" onClick={handleClose} />
          <div className="hidden md:block absolute bottom-full left-0 z-[70] mb-2 w-72 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-2.5 text-center">
              <p className="text-xs font-medium text-gray-500">蝶灵帮你回复</p>
            </div>
            {!preview ? (
              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-800">上下文范围</span>
                  <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-lg border-0 bg-gray-50 px-2 py-1 text-xs text-gray-600 focus:outline-none">
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>最近 {n} 条</option>
                    ))}
                  </select>
                </div>
                {onSend && (
                  <div className="px-4 py-2.5">
                    <p className="mb-1.5 text-sm text-gray-800">回复方式</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setMode("draft")} className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${mode === "draft" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>填入输入框</button>
                      <button type="button" onClick={() => setMode("auto_send")} className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${mode === "auto_send" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>预览后发送</button>
                    </div>
                  </div>
                )}
                <div className="px-4 py-2.5">
                  <p className="mb-1.5 text-sm text-gray-800">自定义要求<span className="text-gray-400 text-xs">（可选）</span></p>
                  <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="例如：温柔一点、简短一点……" className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <button type="button" onClick={() => void generate()} disabled={loading} className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-semibold text-blue-600 disabled:opacity-60 hover:bg-gray-50 active:bg-gray-50">
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  {loading ? "蝶灵生成中…" : "生成回复"}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-2.5"><p className="text-xs text-amber-600">这条消息会以你的身份发送，请确认后再发送。</p></div>
                <div className="px-4 py-3"><p className="whitespace-pre-wrap text-sm text-gray-800">{preview}</p></div>
                <button type="button" onClick={() => void confirmSend()} disabled={sending} className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-semibold text-blue-600 disabled:opacity-60 hover:bg-gray-50 active:bg-gray-50">
                  {sending && <Loader2 size={13} className="animate-spin" />}
                  {sending ? "发送中…" : "确认发送"}
                </button>
                <button type="button" onClick={() => setPreview(null)} className="flex w-full items-center justify-center py-2.5 text-xs text-gray-500 hover:bg-gray-50 active:bg-gray-50">返回修改</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

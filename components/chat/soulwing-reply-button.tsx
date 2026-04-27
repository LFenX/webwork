"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent } from "@/components/ui/dialog"

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

  const handleOpen = () => {
    setOpen(true)
    setPreview(null)
    setInstruction("")
    setMode("draft")
  }

  const generate = async () => {
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
        setOpen(false)
      } else {
        setPreview(reply)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成回复失败")
    } finally {
      setLoading(false)
    }
  }

  const confirmSend = async () => {
    if (!preview || !onSend) return
    setSending(true)
    try {
      await onSend(preview)
      toast.success("消息已发送")
      setOpen(false)
    } catch {
      toast.error("发送失败")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        title="让蝶灵帮我回复"
        onClick={handleOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[#ededed] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Image src="/soulwing-icon-24.png" alt="蝶灵" width={20} height={20} className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <div className="max-h-[90dvh] overflow-y-auto rounded-[--radius-xl] p-5">
            <h3 className="mb-1 text-base font-semibold text-[--color-text-primary]">蝶灵帮你回复</h3>
            <p className="mb-4 text-xs text-[--color-text-muted]">
              蝶灵会读取当前聊天最近的消息，帮你生成一条适合当前语境的回复。
            </p>

            {!preview ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">上下文范围</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm shadow-none"
                  >
                    {[10, 20, 50, 100].map((n) => <option key={n} value={n}>最近 {n} 条</option>)}
                  </select>
                </div>

                {onSend && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">回复方式</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMode("draft")}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
                          mode === "draft" ? "bg-[--color-brand] text-white" : "bg-[--color-bg-hover] text-[--color-text-secondary]"
                        }`}
                      >
                        生成到输入框
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("auto_send")}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
                          mode === "auto_send" ? "bg-[--color-brand] text-white" : "bg-[--color-bg-hover] text-[--color-text-secondary]"
                        }`}
                      >
                        预览后发送
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-[--color-text-secondary]">自定义要求（可选）</label>
                  <Textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    rows={2}
                    placeholder="例如：温柔一点、简短一点、像我平时语气一样……"
                    className="min-h-[50px] resize-none rounded-[--radius-md] bg-[--color-bg-surface] text-sm shadow-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={generate} disabled={loading} className="flex-1 rounded-full shadow-none">
                    {loading ? "蝶灵正在理解聊天语境……" : "生成回复"}
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full shadow-none text-xs">
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[--radius-md] bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  这条消息会以你的身份发送，请确认内容后再发送。
                </div>
                <div className="whitespace-pre-wrap rounded-[--radius-md] bg-[--color-bg-hover] px-4 py-3 text-sm text-[--color-text-primary]">
                  {preview}
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmSend} disabled={sending} className="flex-1 rounded-full shadow-none">
                    {sending ? "发送中..." : "确认发送"}
                  </Button>
                  <Button variant="outline" onClick={() => setPreview(null)} className="rounded-full shadow-none text-xs">
                    返回修改
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

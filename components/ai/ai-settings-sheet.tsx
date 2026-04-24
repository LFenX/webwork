"use client"

import { useState } from "react"
import { KeyRound, PlugZap, Save, TestTube2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  loadModelCatalog,
  modelCatalogToTextareaValue,
  saveModelCatalog,
} from "@/lib/ai/model-presets"

type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

type ConfigPayload = {
  providerLabel: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: string
  streamEnabled: boolean
  isEnabled: boolean
}

type UserConfigStatus = {
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number
  streamEnabled: boolean
  capabilities?: AIProviderCapabilities | null
  isEnabled: boolean
  apiKeyMask: string
  lastTestStatus: string
  lastTestedAt: string | null
}

const DEFAULT_FORM: ConfigPayload = {
  providerLabel: "OpenAI-compatible",
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.7",
  streamEnabled: true,
  isEnabled: true,
}

function buildForm(userConfig: UserConfigStatus | null) {
  if (!userConfig) return DEFAULT_FORM

  return {
    providerLabel: userConfig.providerLabel,
    baseUrl: userConfig.baseUrl,
    apiKey: "",
    model: userConfig.model,
    temperature: String(userConfig.temperature ?? 0.7),
    streamEnabled: userConfig.streamEnabled,
    isEnabled: userConfig.isEnabled,
  }
}

function CapabilityPills({ capabilities }: { capabilities: AIProviderCapabilities | null }) {
  if (!capabilities) return null

  const items: Array<[string, boolean]> = [
    ["流式", capabilities.streamText],
    ["工具调用", capabilities.toolCalling],
    ["图片理解", capabilities.visionInput],
    ["思考流", capabilities.reasoningStream],
  ]

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map(([label, supported]) => (
        <span
          key={label}
          className={`inline-flex rounded-full border px-3 py-1 text-xs ${supported ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function AISettingsSheetBody({
  status,
  onOpenChange,
  onSaved,
}: {
  status: {
    storageReady?: boolean
    userConfig: UserConfigStatus | null
  } | null
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void> | void
}) {
  const [form, setForm] = useState<ConfigPayload>(() => buildForm(status?.userConfig ?? null))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testedCapabilities, setTestedCapabilities] = useState<AIProviderCapabilities | null>(status?.userConfig?.capabilities ?? null)
  const [modelCatalogText, setModelCatalogText] = useState(() => {
    const providerLabel = status?.userConfig?.providerLabel ?? DEFAULT_FORM.providerLabel
    const baseUrl = status?.userConfig?.baseUrl ?? DEFAULT_FORM.baseUrl
    const fallbackModel = status?.userConfig?.model ?? DEFAULT_FORM.model
    const catalog = loadModelCatalog(providerLabel, baseUrl, fallbackModel)
    return modelCatalogToTextareaValue(catalog.models)
  })
  const storageReady = status?.storageReady ?? true

  async function handleSave() {
    setSaving(true)
    try {
      const catalog = saveModelCatalog(
        form.providerLabel,
        form.baseUrl,
        modelCatalogText
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        form.model,
      )
      setModelCatalogText(modelCatalogToTextareaValue(catalog.models))
      const res = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerLabel: form.providerLabel,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
          temperature: Number(form.temperature || "0.7"),
          streamEnabled: form.streamEnabled,
          isEnabled: form.isEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "保存配置失败")
      toast.success("AI 配置已保存")
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch("/api/ai/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerLabel: form.providerLabel,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
          temperature: Number(form.temperature || "0.7"),
          streamEnabled: form.streamEnabled,
          isEnabled: form.isEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "连接测试失败")
      setTestedCapabilities(data?.capabilities ?? null)
      toast.success("连接测试成功")
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接测试失败")
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const res = await fetch("/api/ai/config", { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "删除配置失败")
      toast.success("已删除自定义 AI 配置")
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除配置失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetContent side="right" className="w-[min(100vw,520px)] sm:max-w-none">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <KeyRound size={18} />
          AI 模型配置
        </SheetTitle>
        <SheetDescription>
          按 OpenAI-compatible 方式保存 provider。测试时会探测流式、工具调用、图片理解和思考流能力。
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {!storageReady ? (
          <div className="rounded-[--radius-lg] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            服务端未配置 <code>AI_SECRET_KEY</code>，当前无法安全保存或更新 AI 凭证。请先在项目根目录的 <code>.env</code> 中添加该变量，并重启开发服务器。
          </div>
        ) : null}

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted]">当前掩码</p>
          <p className="mt-1 text-sm text-[--color-text-primary]">{status?.userConfig?.apiKeyMask || "尚未配置"}</p>
          <p className="mt-2 text-xs text-[--color-text-muted]">
            最近测试：{status?.userConfig?.lastTestStatus || "unknown"}
            {status?.userConfig?.lastTestedAt ? ` / ${new Date(status.userConfig.lastTestedAt).toLocaleString("zh-CN")}` : ""}
          </p>
          <CapabilityPills capabilities={testedCapabilities} />
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">Provider 名称</Label>
            <Input value={form.providerLabel} onChange={(event) => setForm((current) => ({ ...current, providerLabel: event.target.value }))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Base URL</Label>
            <Input value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com/v1" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">API Key</Label>
            <Input type="password" value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder="输入新的 API Key 用于更新" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Model</Label>
            <Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="gpt-4.1-mini / deepseek-chat / qwen..." />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Model list for quick switch</Label>
            <Textarea
              value={modelCatalogText}
              onChange={(event) => setModelCatalogText(event.target.value)}
              rows={5}
              placeholder={"Enter one model per line, for example:\nqwen3.6-plus\ngpt-4.1-mini\ndeepseek-chat"}
              className="min-h-[132px] resize-y"
            />
            <p className="mt-2 text-xs text-[--color-text-muted]">
              Saved locally for this provider. After saving, models can be switched from the &quot;Advanced&quot; menu in the chat input.
            </p>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Temperature</Label>
            <Input value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} />
          </div>
          <div className="flex items-center justify-between rounded-[--radius-lg] border border-[--color-border] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">启用流式响应</p>
              <p className="text-xs text-[--color-text-muted]">provider 支持时会沿用这个开关。</p>
            </div>
            <input type="checkbox" checked={form.streamEnabled} onChange={(event) => setForm((current) => ({ ...current, streamEnabled: event.target.checked }))} />
          </div>
          <div className="flex items-center justify-between rounded-[--radius-lg] border border-[--color-border] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">启用这份配置</p>
              <p className="text-xs text-[--color-text-muted]">关闭后会退回到管理员授权或不可用状态。</p>
            </div>
            <input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
            <TestTube2 size={14} /> {testing ? "测试中..." : "测试连接"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !storageReady}>
            <Save size={14} /> {saving ? "保存中..." : "保存配置"}
          </Button>
          <Button type="button" variant="outline" onClick={handleDelete} disabled={saving || !storageReady}>
            <Trash2 size={14} /> 删除配置
          </Button>
        </div>

        <div className="rounded-[--radius-lg] border border-dashed border-[--color-border] bg-[--color-bg-hover] p-4 text-sm text-[--color-text-secondary]">
          <div className="flex items-center gap-2 font-medium text-[--color-text-primary]">
            <PlugZap size={15} />
            Provider 能力说明
          </div>
          <p className="mt-2">
            如果某项能力灰掉，AI 页面会明确提示降级原因，例如不支持多图理解、原生工具调用或 reasoning 流，而不会伪装成成功执行。
          </p>
        </div>
      </div>
    </SheetContent>
  )
}

export function AISettingsSheet({
  open,
  onOpenChange,
  status,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: {
    storageReady?: boolean
    userConfig: UserConfigStatus | null
  } | null
  onSaved: () => Promise<void> | void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AISettingsSheetBody
          key={status?.userConfig?.lastTestedAt ?? status?.userConfig?.apiKeyMask ?? "empty"}
          status={status}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  )
}

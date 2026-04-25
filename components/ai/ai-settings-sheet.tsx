"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, KeyRound, PlugZap, Plus, Save, TestTube2, Trash2 } from "lucide-react"
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
import { getDict } from "@/lib/i18n"
import type { AIUserConfigSummary } from "@/lib/ai/types"

type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

type ConfigPayload = {
  name: string
  providerLabel: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: string
  streamEnabled: boolean
  isEnabled: boolean
}

const DEFAULT_FORM: ConfigPayload = {
  name: "",
  providerLabel: "OpenAI-compatible",
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.7",
  streamEnabled: true,
  isEnabled: true,
}

function buildForm(config: AIUserConfigSummary): ConfigPayload {
  return {
    name: config.name || "",
    providerLabel: config.providerLabel,
    baseUrl: config.baseUrl,
    apiKey: "",
    model: config.model,
    temperature: String(config.temperature ?? 0.7),
    streamEnabled: config.streamEnabled,
    isEnabled: config.isEnabled,
  }
}

function CapabilityPills({ capabilities, dict }: { capabilities: AIProviderCapabilities | null; dict: ReturnType<typeof getDict> }) {
  if (!capabilities) return null

  const items: Array<[string, boolean]> = [
    [dict.ai.streaming, capabilities.streamText],
    [dict.ai.toolCalling, capabilities.toolCalling],
    [dict.ai.imageUnderstanding, capabilities.visionInput],
    [dict.ai.thinkingStream, capabilities.reasoningStream],
  ]

  return (
    <div className="mt-3 flex flex-wrap gap-2">
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
  storageReady,
  onOpenChange,
  onSaved,
}: {
  storageReady: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void> | void
}) {
  const dict = getDict()
  const [configs, setConfigs] = useState<AIUserConfigSummary[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ConfigPayload>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testedCapabilities, setTestedCapabilities] = useState<AIProviderCapabilities | null>(null)
  const [testStatus, setTestStatus] = useState<{ status: string; testedAt: string | null } | null>(null)
  const [modelCatalogText, setModelCatalogText] = useState("")

  const loadConfigs = useCallback(async () => {
    setConfigsLoading(true)
    try {
      const res = await fetch("/api/ai/configs", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (data?.configs) setConfigs(data.configs as AIUserConfigSummary[])
    } catch {
      // ignore
    } finally {
      setConfigsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching config list on mount
    void loadConfigs()
  }, [loadConfigs])

  function resetForm() {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setTestedCapabilities(null)
    setTestStatus(null)
    setModelCatalogText("")
  }

  function loadConfig(config: AIUserConfigSummary) {
    const f = buildForm(config)
    setForm(f)
    setEditingId(config.id)
    setTestedCapabilities(null)
    setTestStatus(config.lastTestedAt ? { status: config.lastTestStatus, testedAt: config.lastTestedAt } : null)
    const catalog = loadModelCatalog(config.providerLabel, config.baseUrl, config.model)
    setModelCatalogText(modelCatalogToTextareaValue(catalog.models))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(dict.ai.configNamePlaceholder)
      return
    }
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

      const body = {
        name: form.name.trim(),
        providerLabel: form.providerLabel,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        model: form.model,
        temperature: Number(form.temperature || "0.7"),
        streamEnabled: form.streamEnabled,
        isEnabled: form.isEnabled,
      }

      const url = editingId ? `/api/ai/configs/${editingId}` : "/api/ai/configs"
      const method = editingId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.saveConfigFailed)
      toast.success(dict.ai.configSaved)
      await loadConfigs()
      if (!editingId && data?.config?.id) {
        setEditingId(data.config.id)
      }
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.saveConfigFailed)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const body: Record<string, unknown> = {
        providerLabel: form.providerLabel,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        model: form.model,
        temperature: Number(form.temperature || "0.7"),
        streamEnabled: form.streamEnabled,
        isEnabled: form.isEnabled,
      }
      if (editingId) body.configId = editingId

      const res = await fetch("/api/ai/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.testConnectionFailed)
      setTestedCapabilities(data?.capabilities ?? null)
      setTestStatus({ status: "passed", testedAt: new Date().toISOString() })
      toast.success(dict.ai.testConnectionSuccess)
    } catch (error) {
      setTestStatus({ status: "failed", testedAt: new Date().toISOString() })
      toast.error(error instanceof Error ? error.message : dict.ai.testConnectionFailed)
    } finally {
      setTesting(false)
    }
  }

  async function handleDeleteConfig(configId: string, configName: string) {
    if (!confirm(dict.ai.confirmDeleteConfig.replace("{name}", configName))) return
    try {
      const res = await fetch(`/api/ai/configs/${configId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? dict.ai.deleteConfigFailed)
      }
      toast.success(dict.ai.configDeleted)
      if (editingId === configId) resetForm()
      await loadConfigs()
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.deleteConfigFailed)
    }
  }

  async function handleActivate(configId: string) {
    try {
      const res = await fetch(`/api/ai/configs/${configId}/activate`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success(dict.ai.configActivated)
      await loadConfigs()
      await onSaved()
    } catch {
      toast.error(dict.ai.saveConfigFailed)
    }
  }

  const activeConfig = configs.find((c) => c.isActive)

  return (
    <SheetContent side="right" className="w-[min(100vw,520px)] sm:max-w-none overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <KeyRound size={18} />
          {dict.ai.settingsSheetTitle}
        </SheetTitle>
        <SheetDescription>
          {dict.ai.settingsSheetDescription}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {!storageReady ? (
          <div className="rounded-[--radius-lg] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {dict.ai.storageNotReadyWarning}
          </div>
        ) : null}

        {/* Saved configs list */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-[--color-text-muted]">{dict.ai.savedConfigs}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <Plus size={14} className="mr-1" />
              {dict.ai.newConfig}
            </Button>
          </div>
          {configsLoading ? (
            <p className="mt-2 text-xs text-[--color-text-muted]">{dict.ai.loadingConfigs}</p>
          ) : configs.length === 0 ? (
            <p className="mt-2 text-xs text-[--color-text-muted]">{dict.ai.noSavedConfigs}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`rounded-[--radius-lg] border p-3 ${config.isActive ? "border-emerald-300 bg-emerald-50/50" : "border-[--color-border] bg-[--color-bg-surface]"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[--color-text-primary]">{config.name || config.providerLabel}</span>
                        {config.isActive ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            <CheckCircle2 size={10} />
                            {dict.ai.activeBadge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[--color-text-muted]">
                        {config.providerLabel} / {config.model || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-[--color-text-muted]">
                        {config.apiKeyMask} &middot; {dict.ai.lastTest}{config.lastTestStatus}
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 gap-1">
                      {!config.isActive ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleActivate(config.id)} title={dict.ai.activateConfig}>
                          <CheckCircle2 size={14} />
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="sm" onClick={() => loadConfig(config)} title={dict.ai.loadConfig}>
                        <PlugZap size={14} />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteConfig(config.id, config.name || config.providerLabel)} title={dict.ai.deleteConfigBtn}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[--color-border]" />

        {/* Current status */}
        {editingId || activeConfig ? (
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <p className="text-xs text-[--color-text-muted]">
              {editingId ? `${dict.ai.loadConfigPrompt}` : `${dict.ai.activeConfig}: ${activeConfig?.name || activeConfig?.providerLabel || ""}`}
            </p>
            {editingId ? (
              <p className="mt-1 text-xs text-[--color-text-muted]">
                {dict.ai.lastTest}{testStatus?.status ?? "unknown"}
                {testStatus?.testedAt ? ` / ${new Date(testStatus.testedAt).toLocaleString()}` : ""}
              </p>
            ) : null}
            <CapabilityPills capabilities={testedCapabilities} dict={dict} />
          </div>
        ) : null}

        {/* Form */}
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.configName}</Label>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={dict.ai.configNamePlaceholder} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.providerLabel}</Label>
            <Input value={form.providerLabel} onChange={(event) => setForm((current) => ({ ...current, providerLabel: event.target.value }))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.baseUrl}</Label>
            <Input value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com/v1" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.apiKey}</Label>
            <Input type="password" value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={dict.ai.apiKeyPlaceholder} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.model}</Label>
            <Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder={dict.ai.modelPlaceholder} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.modelListLabel}</Label>
            <Textarea
              value={modelCatalogText}
              onChange={(event) => setModelCatalogText(event.target.value)}
              rows={5}
              placeholder={dict.ai.modelListPlaceholder}
              className="min-h-[132px] resize-y"
            />
            <p className="mt-2 text-xs text-[--color-text-muted]">{dict.ai.modelListHint}</p>
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.temperature}</Label>
            <Input value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} />
          </div>
          <div className="flex items-center justify-between rounded-[--radius-lg] border border-[--color-border] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">{dict.ai.streamEnabled}</p>
              <p className="text-xs text-[--color-text-muted]">{dict.ai.streamEnabledHint}</p>
            </div>
            <input type="checkbox" checked={form.streamEnabled} onChange={(event) => setForm((current) => ({ ...current, streamEnabled: event.target.checked }))} />
          </div>
          <div className="flex items-center justify-between rounded-[--radius-lg] border border-[--color-border] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">{dict.ai.enableConfigLabel}</p>
              <p className="text-xs text-[--color-text-muted]">{dict.ai.enableConfigHint}</p>
            </div>
            <input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
            <TestTube2 size={14} /> {testing ? dict.ai.testingConnection : dict.ai.testConnectionBtn}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !storageReady}>
            <Save size={14} /> {saving ? dict.ai.savingConfig : dict.ai.saveConfigBtn}
          </Button>
        </div>

        <div className="rounded-[--radius-lg] border border-dashed border-[--color-border] bg-[--color-bg-hover] p-4 text-sm text-[--color-text-secondary]">
          <div className="flex items-center gap-2 font-medium text-[--color-text-primary]">
            <PlugZap size={15} />
            {dict.ai.capabilityDescriptionTitle}
          </div>
          <p className="mt-2">{dict.ai.capabilityDescriptionHint}</p>
        </div>
      </div>
    </SheetContent>
  )
}

export function AISettingsSheet({
  open,
  onOpenChange,
  storageReady,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storageReady: boolean
  onSaved: () => Promise<void> | void
}) {
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- key rotation on sheet open is intentional
    if (open) setFormKey(Date.now())
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {formKey !== 0 ? (
        <AISettingsSheetBody
          key={formKey}
          storageReady={storageReady}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  )
}

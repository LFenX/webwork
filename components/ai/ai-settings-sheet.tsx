"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, KeyRound, PlugZap, Plus, Save, ShieldCheck, TestTube2, Trash2, X } from "lucide-react"
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
import { confirmAction } from "@/lib/interaction-feedback"

type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

type UnifiedConfigItem = {
  id: string
  source: "self" | "admin_grant"
  name: string
  isActive: boolean
  providerLabel: string
  baseUrl: string
  model: string
  modelList: string[]
  temperature: number
  streamEnabled: boolean
  isEnabled: boolean
  apiKeyMask: string
  status: string
  lastTestStatus: string
  lastTestedAt: string | null
  grantedByAdminId?: string
}

type AccessRequestInfo = {
  id: string
  status: string
  message: string
  reviewNote: string
  createdAt: string
  reviewedAt: string | null
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

type WebSearchPayload = {
  enabled: boolean
  configured: boolean
  apiKeyMask: string
  apiKey: string
  host: string
  workspace: string
  serviceId: string
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

const DEFAULT_WEB_SEARCH_FORM: WebSearchPayload = {
  enabled: false,
  configured: false,
  apiKeyMask: "",
  apiKey: "",
  host: "",
  workspace: "default",
  serviceId: "ops-web-search-001",
}

function buildForm(config: UnifiedConfigItem): ConfigPayload {
  return {
    name: config.source === "self" ? (config.name || "") : "",
    providerLabel: config.providerLabel,
    baseUrl: config.baseUrl,
    apiKey: "",
    model: config.model,
    temperature: String(config.temperature ?? 0.7),
    streamEnabled: config.streamEnabled,
    isEnabled: config.isEnabled,
  }
}

function statusBadge(status: string, dict: ReturnType<typeof getDict>) {
  switch (status) {
    case "active":
      return { label: dict.ai.grantStatusActive, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    case "paused":
      return { label: dict.ai.grantStatusPaused, cls: "border-amber-200 bg-amber-50 text-amber-700" }
    case "revoked":
      return { label: dict.ai.grantStatusRevoked, cls: "border-red-200 bg-red-50 text-red-700" }
    case "deprecated":
      return { label: dict.ai.grantStatusDeprecated, cls: "border-slate-200 bg-slate-100 text-slate-500" }
    default:
      return { label: status, cls: "border-slate-200 bg-slate-100 text-slate-500" }
  }
}

function requestStatusLabel(status: string, dict: ReturnType<typeof getDict>) {
  switch (status) {
    case "pending": return dict.ai.requestStatusPending
    case "approved": return dict.ai.requestStatusApproved
    case "configured": return dict.ai.requestStatusConfigured
    case "rejected": return dict.ai.requestStatusRejected
    case "cancelled": return dict.ai.requestStatusCancelled
    default: return status
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
  const [configs, setConfigs] = useState<UnifiedConfigItem[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingSource, setEditingSource] = useState<"self" | "admin_grant">("self")
  const [form, setForm] = useState<ConfigPayload>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configActionId, setConfigActionId] = useState<string | null>(null)
  const [webSearchSaving, setWebSearchSaving] = useState(false)
  const [webSearchTesting, setWebSearchTesting] = useState(false)
  const [testedCapabilities, setTestedCapabilities] = useState<AIProviderCapabilities | null>(null)
  const [testStatus, setTestStatus] = useState<{ status: string; testedAt: string | null } | null>(null)
  const [modelCatalogText, setModelCatalogText] = useState("")
  const [webSearchForm, setWebSearchForm] = useState<WebSearchPayload>(DEFAULT_WEB_SEARCH_FORM)

  // Access request state
  const [accessRequest, setAccessRequest] = useState<AccessRequestInfo | null>(null)
  const [requestMessage, setRequestMessage] = useState("")
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [cancellingRequest, setCancellingRequest] = useState(false)

  const loadConfigs = useCallback(async () => {
    setConfigsLoading(true)
    try {
      const res = await fetch("/api/ai/configs", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (data?.configs) {
        const nextConfigs = data.configs as UnifiedConfigItem[]
        setConfigs(nextConfigs)
        if (!editingId) {
          const activeSelfConfig = nextConfigs.find((config) => config.isActive && config.source === "self")
          if (activeSelfConfig) loadConfig(activeSelfConfig)
        }
      }
    } catch {
      // ignore
    } finally {
      setConfigsLoading(false)
    }
    // loadConfig is a local event-style helper; including it here would recreate this loader every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const loadAccessRequest = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/access-request", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (data?.request) setAccessRequest(data.request as AccessRequestInfo)
      else setAccessRequest(null)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching config and request list on mount
    void loadConfigs()
    void loadAccessRequest()
  }, [loadConfigs, loadAccessRequest])

  function resetForm() {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setEditingSource("self")
    setTestedCapabilities(null)
    setTestStatus(null)
    setModelCatalogText("")
    setWebSearchForm(DEFAULT_WEB_SEARCH_FORM)
  }

  function loadConfig(config: UnifiedConfigItem) {
    const f = buildForm(config)
    setForm(f)
    setEditingId(config.id)
    setEditingSource(config.source)
    setTestedCapabilities(null)
    setTestStatus(config.lastTestedAt ? { status: config.lastTestStatus, testedAt: config.lastTestedAt } : null)

    if (config.source === "admin_grant" && config.modelList.length > 0) {
      setModelCatalogText(modelCatalogToTextareaValue(config.modelList))
    } else if (config.source === "self") {
      const catalog = loadModelCatalog(config.providerLabel, config.baseUrl, config.model)
      setModelCatalogText(modelCatalogToTextareaValue(catalog.models))
    } else {
      setModelCatalogText("")
    }

    if (config.source === "self") {
      void loadWebSearchConfig(config.id)
    } else {
      setWebSearchForm(DEFAULT_WEB_SEARCH_FORM)
    }
  }

  async function loadWebSearchConfig(configId: string) {
    try {
      const res = await fetch(`/api/ai/configs/${configId}/web-search`, { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to load web search config")
      const item = data?.webSearch
      setWebSearchForm({
        ...DEFAULT_WEB_SEARCH_FORM,
        enabled: Boolean(item?.enabled),
        configured: Boolean(item?.configured),
        apiKeyMask: item?.apiKeyMask ?? "",
        apiKey: "",
        host: item?.host || "",
        workspace: item?.workspace || DEFAULT_WEB_SEARCH_FORM.workspace,
        serviceId: item?.serviceId || DEFAULT_WEB_SEARCH_FORM.serviceId,
      })
    } catch {
      setWebSearchForm(DEFAULT_WEB_SEARCH_FORM)
    }
  }

  async function handleSave() {
    if (!form.name.trim() && editingSource === "self") {
      toast.error(dict.ai.configNamePlaceholder)
      return
    }

    // Cannot edit admin grants
    if (editingSource === "admin_grant") {
      toast.error("管理员授权配置不能编辑，请联系管理员修改")
      return
    }

    setSaving(true)
    try {
      const modelList = modelCatalogText
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)

      const catalog = saveModelCatalog(
        form.providerLabel,
        form.baseUrl,
        modelList,
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
        modelList,
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
      if (editingId && editingSource === "self") body.configId = editingId

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

  async function handleSaveWebSearch() {
    if (!editingId || editingSource !== "self") return
    setWebSearchSaving(true)
    try {
      const res = await fetch(`/api/ai/configs/${editingId}/web-search`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: webSearchForm.enabled,
          apiKey: webSearchForm.apiKey,
          host: webSearchForm.host.trim() || undefined,
          workspace: webSearchForm.workspace,
          serviceId: webSearchForm.serviceId,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to save web search config")
      const item = data?.webSearch
      setWebSearchForm((current) => ({
        ...current,
        configured: Boolean(item?.configured),
        apiKeyMask: item?.apiKeyMask ?? current.apiKeyMask,
        apiKey: "",
      }))
      toast.success("联网搜索配置已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save web search config")
    } finally {
      setWebSearchSaving(false)
    }
  }

  async function handleTestWebSearch() {
    if (!editingId || editingSource !== "self") return
    setWebSearchTesting(true)
    try {
      const res = await fetch("/api/ai/tools/web-search/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "最近 AI 行业有什么热点",
          maxResults: 5,
          contentType: "snippet",
          configId: editingId,
          webSearch: {
            host: webSearchForm.host.trim() || undefined,
            apiKey: webSearchForm.apiKey.trim() || undefined,
            workspace: webSearchForm.workspace,
            serviceId: webSearchForm.serviceId,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "联网搜索测试失败")
      if (!data?.result?.ok) throw new Error(data?.result?.error ?? "联网搜索测试失败")
      toast.success(`联网搜索测试成功，返回 ${data.result.results.length} 条结果`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "联网搜索测试失败")
    } finally {
      setWebSearchTesting(false)
    }
  }

  async function handleDeleteConfig(configId: string, configName: string) {
    if (!confirmAction(`${dict.ai.confirmDeleteConfig.replace("{name}", configName)}\n删除后该 AI 配置不可直接恢复，正在使用它的会话需要重新选择配置。`)) return
    setConfigActionId(`delete:${configId}`)
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
    } finally {
      setConfigActionId(null)
    }
  }

  async function handleActivate(configId: string, source: string) {
    setConfigActionId(`activate:${configId}`)
    try {
      const res = await fetch(`/api/ai/configs/${configId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 409 && data?.code === "GRANT_PAUSED") {
          toast.error(dict.ai.adminGrantPausedHint)
          return
        }
        if (res.status === 409 && data?.code === "GRANT_REVOKED") {
          toast.error(dict.ai.adminGrantRevokedHint)
          // Remove revoked grant from local list
          setConfigs((current) => current.filter((c) => !(c.id === configId && c.source === "admin_grant")))
          return
        }
        throw new Error(data?.error ?? dict.ai.activateFailed)
      }
      toast.success(dict.ai.configActivated)
      await loadConfigs()
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.saveConfigFailed)
    } finally {
      setConfigActionId(null)
    }
  }

  async function handleSubmitAccessRequest() {
    if (!requestMessage.trim()) return
    setSubmittingRequest(true)
    try {
      const res = await fetch("/api/ai/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.submitRequestFailed)
      toast.success(dict.ai.aiRequestSubmitted)
      setRequestMessage("")
      await loadAccessRequest()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.submitRequestFailed)
    } finally {
      setSubmittingRequest(false)
    }
  }

  async function handleCancelAccessRequest() {
    if (!confirmAction(`${dict.ai.cancelRequestConfirm}\n取消后如仍需管理员授权，需要重新提交申请。`)) return
    setCancellingRequest(true)
    try {
      const res = await fetch("/api/ai/access-request", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Failed to cancel")
      }
      toast.success(dict.ai.requestCancelled)
      await loadAccessRequest()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    } finally {
      setCancellingRequest(false)
    }
  }

  const activeConfig = configs.find((c) => c.isActive)
  const selfConfigs = configs.filter((c) => c.source === "self")
  const grantConfigs = configs.filter((c) => c.source === "admin_grant")

  return (
    <SheetContent side="right" className="w-[min(100vw,560px)] overflow-y-auto border-l border-slate-200 bg-[#f4f7fb] p-0 sm:max-w-none">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-[12px] bg-blue-50 text-blue-600">
            <KeyRound size={18} />
          </span>
          {dict.ai.settingsSheetTitle}
        </SheetTitle>
        <SheetDescription className="text-slate-500">
          {dict.ai.settingsSheetDescription}
        </SheetDescription>
      </SheetHeader>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        {!storageReady ? (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {dict.ai.storageNotReadyWarning}
          </div>
        ) : null}

        {/* Admin Grant Request Section — always visible */}
        <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[--color-text-muted]" />
            <span className="text-sm font-medium text-[--color-text-primary]">{dict.ai.adminGrantRequest}</span>
          </div>
          <p className="mt-1 text-xs text-[--color-text-muted]">{dict.ai.adminGrantDesc}</p>

          {!accessRequest || accessRequest.status === "rejected" || accessRequest.status === "cancelled" ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                rows={3}
                placeholder={dict.ai.requestPlaceholder}
                className="min-h-[80px] resize-y"
              />
              <Button size="sm" className="rounded-full shadow-none" onClick={() => void handleSubmitAccessRequest()} disabled={!requestMessage.trim()} loading={submittingRequest} loadingText={dict.ai.requestingAccess}>
                {dict.ai.applyForGrant}
              </Button>
            </div>
          ) : accessRequest.status === "pending" ? (
            <div className="mt-3 rounded-[--radius-md] border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">{dict.ai.requestStatusPending}</p>
              <p className="mt-1 text-xs text-amber-700">{accessRequest.message}</p>
              <p className="mt-1 text-xs text-amber-600">
                {new Date(accessRequest.createdAt).toLocaleString()}
              </p>
              <Button size="sm" variant="outline" className="mt-2 rounded-full shadow-none" onClick={() => void handleCancelAccessRequest()} loading={cancellingRequest} loadingText={dict.ai.cancelRequest}>
                <X size={14} className="mr-1" />
                {dict.ai.cancelRequest}
              </Button>
            </div>
          ) : accessRequest.status === "approved" ? (
            <div className="mt-3 rounded-[--radius-md] border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-800">{dict.ai.requestStatusApproved}</p>
              <p className="mt-1 text-xs text-blue-700">{dict.admin.aiPanel.awaitingConfig}</p>
            </div>
          ) : accessRequest.status === "configured" ? (
            <div className="mt-3 rounded-[--radius-md] border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">{dict.ai.adminGrantConfigured}</p>
              <p className="mt-1 text-xs text-emerald-700">
                {grantConfigs.length > 0
                  ? dict.ai.requestStatusConfigured
                  : dict.admin.aiPanel.awaitingConfig}
              </p>
            </div>
          ) : null}
        </div>

        {/* Saved configs list */}
        <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
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
              {configs.map((config) => {
                const badge = config.source === "admin_grant" ? statusBadge(config.status, dict) : null
                return (
                  <div
                    key={`${config.source}-${config.id}`}
                    className={`rounded-[16px] border p-3 ${config.isActive ? "border-blue-200 bg-blue-50/60" : "border-slate-100 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.02)]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[--color-text-primary]">
                            {config.name || config.providerLabel}
                          </span>
                          {config.isActive ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                              <CheckCircle2 size={10} />
                              {dict.ai.activeBadge}
                            </span>
                          ) : null}
                          <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs ${
                            config.source === "admin_grant"
                              ? "border border-blue-200 bg-blue-50 text-blue-700"
                              : "border border-slate-200 bg-slate-100 text-slate-600"
                          }`}>
                            {config.source === "admin_grant" ? dict.ai.sourceAdminGrant : dict.ai.sourceSelf}
                          </span>
                          {badge ? (
                            <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>
                              {badge.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[--color-text-muted]">
                          {config.providerLabel} / {config.model || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-[--color-text-muted]">
                          {config.apiKeyMask}
                          {config.source === "self" ? (
                            <> &middot; {dict.ai.lastTest}{config.lastTestStatus}</>
                          ) : null}
                        </p>
                      </div>
                      <div className="ml-2 flex shrink-0 gap-1">
                        {!config.isActive && config.source === "self" ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleActivate(config.id, config.source)} loading={configActionId === `activate:${config.id}`} title={dict.ai.activateConfig}>
                            <CheckCircle2 size={14} />
                          </Button>
                        ) : null}
                        {!config.isActive && config.source === "admin_grant" ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleActivate(config.id, config.source)} loading={configActionId === `activate:${config.id}`} title={dict.ai.activateConfig}>
                            <CheckCircle2 size={14} />
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" size="sm" onClick={() => loadConfig(config)} title={dict.ai.loadConfig}>
                          <PlugZap size={14} />
                        </Button>
                        {config.source === "self" ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteConfig(config.id, config.name || config.providerLabel)} loading={configActionId === `delete:${config.id}`} title={dict.ai.deleteConfigBtn}>
                            <Trash2 size={14} />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* Current status */}
        {editingId || activeConfig ? (
          <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <p className="text-xs text-[--color-text-muted]">
              {editingId ? `${dict.ai.loadConfigPrompt}` : `${dict.ai.activeConfig}: ${activeConfig?.name || activeConfig?.providerLabel || ""}`}
            </p>
            {editingId ? (
              <p className="mt-1 text-xs text-[--color-text-muted]">
                {dict.ai.lastTest}{testStatus?.status ?? "unknown"}
                {testStatus?.testedAt ? ` / ${new Date(testStatus.testedAt).toLocaleString()}` : ""}
              </p>
            ) : null}
            {editingSource === "admin_grant" ? (
              <p className="mt-1 text-xs text-blue-700">
                {dict.ai.sourceAdminGrant} — API Key 不可编辑，如需修改请联系管理员
              </p>
            ) : null}
            <CapabilityPills capabilities={testedCapabilities} dict={dict} />
          </div>
        ) : null}

        {/* Form — only show full edit for self configs */}
        <div className="space-y-3 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.configName}</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={dict.ai.configNamePlaceholder}
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.providerLabel}</Label>
            <Input
              value={form.providerLabel}
              onChange={(event) => setForm((current) => ({ ...current, providerLabel: event.target.value }))}
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.baseUrl}</Label>
            <Input
              name="ai-provider-base-url"
              autoComplete="off"
              value={form.baseUrl}
              onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="例如：https://api.openai.com/v1"
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.apiKey}</Label>
            <Input
              type="password"
              name="ai-provider-api-key"
              autoComplete="new-password"
              data-lpignore="true"
              value={form.apiKey}
              onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder={editingSource === "admin_grant" ? "管理员已配置，不可查看" : "请输入 API Key，例如 sk-..."}
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.model}</Label>
            <Input
              name="ai-default-model"
              autoComplete="off"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              placeholder="例如：gpt-4.1-mini 或 qwen3.6-plus"
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.modelListLabel}</Label>
            <Textarea
              value={modelCatalogText}
              onChange={(event) => setModelCatalogText(event.target.value)}
              rows={5}
              placeholder={dict.ai.modelListPlaceholder}
              className="min-h-[132px] resize-y"
              disabled={editingSource === "admin_grant"}
            />
            <p className="mt-2 text-xs text-[--color-text-muted]">
              {editingSource === "admin_grant"
                ? "管理员配置的模型列表（只读）"
                : dict.ai.modelListHint}
            </p>
          </div>
          <div>
            <Label className="mb-1 block text-xs">{dict.ai.temperature}</Label>
            <Input
              value={form.temperature}
              onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))}
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div className="flex items-center justify-between rounded-[16px] border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">{dict.ai.streamEnabled}</p>
              <p className="text-xs text-[--color-text-muted]">{dict.ai.streamEnabledHint}</p>
            </div>
            <input
              type="checkbox"
              checked={form.streamEnabled}
              onChange={(event) => setForm((current) => ({ ...current, streamEnabled: event.target.checked }))}
              disabled={editingSource === "admin_grant"}
            />
          </div>
          <div className="flex items-center justify-between rounded-[16px] border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[--color-text-primary]">{dict.ai.enableConfigLabel}</p>
              <p className="text-xs text-[--color-text-muted]">{dict.ai.enableConfigHint}</p>
            </div>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
              disabled={editingSource === "admin_grant"}
            />
          </div>
        </div>

        {editingSource === "self" && editingId ? (
          <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[--color-text-primary]">联网搜索</p>
                <p className="mt-1 text-xs leading-6 text-[--color-text-muted]">
                  你当前使用的是自己的模型配置，因此联网搜索也需要使用你自己的阿里云 API Key。系统不会使用管理员的联网搜索额度。
                </p>
              </div>
              <input
                type="checkbox"
                checked={webSearchForm.enabled}
                onChange={(event) => setWebSearchForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
            </div>
            <div className="mt-3 grid gap-3">
              <p className="text-xs text-[--color-text-muted]">
                当前仅支持：阿里云 AI 搜索开放平台 / 服务 ID：ops-web-search-001
                {webSearchForm.configured ? ` / 已配置：${webSearchForm.apiKeyMask}` : " / 未配置 API Key"}
              </p>
              <div>
                <Label className="mb-1 block text-xs">API Key</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={webSearchForm.apiKey}
                  onChange={(event) => setWebSearchForm((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder={webSearchForm.configured ? "已配置，留空则不修改" : "请输入阿里云联网搜索 API Key"}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Host</Label>
                <Input
                  value={webSearchForm.host}
                  onChange={(event) => setWebSearchForm((current) => ({ ...current, host: event.target.value }))}
                  placeholder="http://default-xxxx.platform-cn-shanghai.opensearch.aliyuncs.com"
                />
                <p className="mt-1 text-xs text-[--color-text-muted]">
                  Host 是阿里云 AI 搜索开放平台的服务接入地址，每个阿里云账号或工作空间可能不同，请在阿里云控制台复制自己的公网服务地址。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Workspace</Label>
                  <Input
                    value={webSearchForm.workspace}
                    onChange={(event) => setWebSearchForm((current) => ({ ...current, workspace: event.target.value }))}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Service ID</Label>
                  <Input
                    value={webSearchForm.serviceId}
                    onChange={(event) => setWebSearchForm((current) => ({ ...current, serviceId: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleTestWebSearch()} disabled={!webSearchForm.configured} loading={webSearchTesting} loadingText="测试中...">
                  <TestTube2 size={14} /> 测试联网搜索
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleSaveWebSearch()} loading={webSearchSaving} loadingText="保存中...">
                  <Save size={14} /> 保存联网搜索
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {editingSource === "self" ? (
          <div className="flex flex-wrap gap-2 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <Button type="button" variant="outline" onClick={handleTest} loading={testing} loadingText={dict.ai.testingConnection}>
              <TestTube2 size={14} /> {dict.ai.testConnectionBtn}
            </Button>
            <Button type="button" onClick={handleSave} disabled={!storageReady} loading={saving} loadingText={dict.ai.savingConfig}>
              <Save size={14} /> {dict.ai.saveConfigBtn}
            </Button>
          </div>
        ) : null}

        <div className="rounded-[18px] border border-dashed border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-700">
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

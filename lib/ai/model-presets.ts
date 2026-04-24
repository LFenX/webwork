export const AI_MODEL_PRESETS_UPDATED_EVENT = "ai-model-presets-updated"

type StoredModelCatalog = {
  models?: unknown
  selectedModel?: unknown
}

export type AIModelCatalog = {
  models: string[]
  selectedModel: string
}

function sanitizeModel(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeModelList(models: string[]) {
  return Array.from(
    new Set(
      models
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 30)
}

export function buildModelPresetStorageKey(providerLabel: string, baseUrl: string) {
  const label = providerLabel.trim().toLowerCase() || "default"
  const url = baseUrl.trim().toLowerCase() || "default"
  return `ai-model-presets:${label}:${url}`
}

export function loadModelCatalog(providerLabel: string, baseUrl: string, fallbackModel = ""): AIModelCatalog {
  const fallbackModels = normalizeModelList(fallbackModel ? [fallbackModel] : [])
  const fallback = {
    models: fallbackModels,
    selectedModel: fallbackModels[0] ?? "",
  }

  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(buildModelPresetStorageKey(providerLabel, baseUrl))
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as StoredModelCatalog
    const models = normalizeModelList(
      Array.isArray(parsed.models)
        ? parsed.models.map((item) => sanitizeModel(item))
        : [],
    )
    const mergedModels = normalizeModelList([...models, ...fallbackModels])
    const preferredModel = sanitizeModel(parsed.selectedModel)
    return {
      models: mergedModels,
      selectedModel: mergedModels.includes(preferredModel) ? preferredModel : (mergedModels[0] ?? ""),
    }
  } catch {
    return fallback
  }
}

export function saveModelCatalog(providerLabel: string, baseUrl: string, models: string[], selectedModel?: string) {
  const normalizedModels = normalizeModelList(models)
  const nextSelectedModel = normalizedModels.includes((selectedModel ?? "").trim())
    ? (selectedModel ?? "").trim()
    : (normalizedModels[0] ?? "")

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      buildModelPresetStorageKey(providerLabel, baseUrl),
      JSON.stringify({
        models: normalizedModels,
        selectedModel: nextSelectedModel,
      }),
    )
    window.dispatchEvent(new CustomEvent(AI_MODEL_PRESETS_UPDATED_EVENT))
  }

  return {
    models: normalizedModels,
    selectedModel: nextSelectedModel,
  }
}

export function modelCatalogToTextareaValue(models: string[]) {
  return normalizeModelList(models).join("\n")
}

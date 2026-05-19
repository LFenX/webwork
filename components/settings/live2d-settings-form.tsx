"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, Layers, Monitor, Move3D, Smile, Sparkles, UserSquare2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SettingsDivider, SettingsRow, SettingsSection } from "@/components/settings/settings-shell"
import { cn } from "@/lib/utils"
import {
  BUBBLE_NAME_MAX_LENGTH,
  BUBBLE_THEME_IDS,
  type Live2DBubbleTheme,
  type Live2DDisplayMode,
  type Live2DPosition,
  type Live2DSize,
  type UserLive2DSettings,
} from "@/lib/live2d-shared"
import { BUILTIN_MODELS, type BuiltinModel } from "@/lib/live2d-models"

declare global {
  interface Window {
    __live2dResetPosition?: () => void
  }
}

export type Live2DSettingsLabels = {
  displayMode: string
  displayModeHint: string
  modeOff: string
  modeDesktop: string
  modeAll: string
  model: string
  modelHint: string
  position: string
  positionLeftBottom: string
  positionRightBottom: string
  size: string
  sizeSmall: string
  sizeMedium: string
  sizeLarge: string
  drag: string
  dragHint: string
  on: string
  off: string
  resetPosition: string
  resetPositionDone: string
  bubbleTheme: string
  bubbleThemeHint: string
  bubbleThemeDreamyGlass: string
  bubbleThemeCuteSticker: string
  bubbleThemeMinimalSoft: string
  bubbleThemeMagicFantasy: string
  bubbleName: string
  bubbleNameHint: string
  bubbleNamePlaceholder: string
  preview: string
  previewHint: string
  save: string
  saving: string
  saved: string
  saveFailed: string
  reloadNote: string
}

type SegmentedOption<T extends string> = { value: T; label: string; icon?: React.ReactNode }

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  fullWidth = false,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  fullWidth?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-stretch gap-1 rounded-full border border-[--color-border] bg-[--color-bg-soft] p-1",
        fullWidth ? "w-full" : "",
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium leading-none transition-all",
              active
                ? "bg-[--color-bg-surface] text-[--color-text-primary] shadow-[0_4px_12px_-6px_rgba(15,23,42,0.18)]"
                : "text-[--color-text-secondary] hover:text-[--color-text-primary]",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

type ThemeSwatch = {
  background: string
  border: string
  badgeBg: string
  badgeColor: string
  textColor: string
  shadow: string
  tailColor: string
}

const THEME_SWATCHES: Record<Live2DBubbleTheme, ThemeSwatch> = {
  "dreamy-glass": {
    background:
      "radial-gradient(120% 80% at 10% 0%, rgba(255,214,233,0.7), transparent 60%), radial-gradient(120% 80% at 100% 100%, rgba(196,181,253,0.7), transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))",
    border: "1px solid rgba(255,255,255,0.85)",
    badgeBg: "linear-gradient(135deg, #c8a5ff, #ffb3d1)",
    badgeColor: "#ffffff",
    textColor: "#3a2e5c",
    shadow: "0 10px 30px -10px rgba(176,122,232,0.45), 0 0 20px rgba(255,192,220,0.35)",
    tailColor: "rgba(255,255,255,0.85)",
  },
  "cute-sticker": {
    background: "#fff8fb",
    border: "2px solid #ffc1d4",
    badgeBg: "#ff8bb2",
    badgeColor: "#ffffff",
    textColor: "#5b3a4a",
    shadow: "4px 4px 0 0 #ffc1d4",
    tailColor: "#fff8fb",
  },
  "minimal-soft": {
    background: "#ffffff",
    border: "1px solid #eef0f3",
    badgeBg: "#f6f7f9",
    badgeColor: "#475569",
    textColor: "#1f2937",
    shadow: "0 8px 22px -12px rgba(15,23,42,0.22)",
    tailColor: "#ffffff",
  },
  "magic-fantasy": {
    background:
      "radial-gradient(140% 90% at 0% 0%, rgba(141,92,255,0.85), transparent 60%), radial-gradient(140% 90% at 100% 100%, rgba(67,56,202,0.95), transparent 55%), linear-gradient(135deg, #2a1b5e, #4c1d95)",
    border: "1px solid rgba(255,215,145,0.45)",
    badgeBg: "linear-gradient(135deg, #ffe9b5, #ffd591)",
    badgeColor: "#2a1b5e",
    textColor: "#f4f0ff",
    shadow: "0 12px 28px -10px rgba(76,29,149,0.7), 0 0 20px rgba(141,92,255,0.55)",
    tailColor: "#4c1d95",
  },
}

function BubblePreviewCard({
  theme,
  name,
  active,
  label,
  onSelect,
  sampleText,
}: {
  theme: Live2DBubbleTheme
  name: string
  active: boolean
  label: string
  onSelect: () => void
  sampleText: string
}) {
  const s = THEME_SWATCHES[theme]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col gap-3 rounded-[--radius-lg] border bg-[--color-bg-soft] p-3 text-left transition-all",
        active
          ? "border-[--color-brand] shadow-[0_0_0_3px_var(--color-brand-soft)]"
          : "border-[--color-border] hover:-translate-y-px hover:border-[--color-brand-border] hover:bg-[--color-bg-surface]",
      )}
    >
      <div
        className="relative h-24 w-full overflow-visible rounded-[16px] px-3 pt-4"
        style={{
          background: s.background,
          border: s.border,
          boxShadow: s.shadow,
          color: s.textColor,
        }}
      >
        {name ? (
          <span
            className="absolute -top-2 left-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: s.badgeBg,
              color: s.badgeColor,
              border: theme === "cute-sticker" ? "1.5px solid #fff" : "1px solid rgba(255,255,255,0.7)",
            }}
          >
            {name}
          </span>
        ) : null}
        <div className="mt-1 text-[11px] leading-snug" style={{ color: s.textColor }}>
          {sampleText}
        </div>
        <span
          aria-hidden
          className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45"
          style={{
            background: s.tailColor,
            border: s.border,
            borderTop: "none",
            borderLeft: "none",
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[--color-text-primary]">{label}</span>
        {active ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[--color-brand] text-white">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : null}
      </div>
    </button>
  )
}

function ModelThumbnail({
  model,
  active,
  onSelect,
}: {
  model: BuiltinModel
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={model.description ?? model.name}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[--radius-lg] border bg-[--color-bg-surface] p-2 text-left transition-all",
        active
          ? "border-[--color-brand] shadow-[0_0_0_3px_var(--color-brand-soft)]"
          : "border-[--color-border] hover:-translate-y-px hover:border-[--color-brand-border] hover:shadow-[--shadow-sm]",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-gradient-to-br from-[#f5f5f7] to-[#ecedf0]">
        <Image
          src={model.previewImage}
          alt={model.name}
          fill
          sizes="(max-width: 640px) 30vw, (max-width: 1024px) 18vw, 140px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          quality={70}
          unoptimized={false}
        />
        {active ? (
          <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[--color-brand] text-white shadow-[0_4px_10px_-2px_rgba(37,99,235,0.4)]">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="px-1 pb-0.5">
        <div className="truncate text-[12.5px] font-medium leading-tight text-[--color-text-primary]">{model.name}</div>
        {model.tags?.length ? (
          <div className="mt-0.5 truncate text-[10.5px] uppercase tracking-wide text-[--color-text-muted]">
            {model.tags.join(" · ")}
          </div>
        ) : null}
      </div>
    </button>
  )
}

function StagePreview({
  displayMode,
  position,
  size,
  drag,
  selectedModel,
  bubbleTheme,
  badgeName,
  caption,
}: {
  displayMode: Live2DDisplayMode
  position: Live2DPosition
  size: Live2DSize
  drag: boolean
  selectedModel: BuiltinModel | undefined
  bubbleTheme: Live2DBubbleTheme
  badgeName: string
  caption: string
}) {
  const visible = displayMode !== "off"
  const swatch = THEME_SWATCHES[bubbleTheme]
  const characterSize = size === "small" ? 64 : size === "large" ? 104 : 84
  const alignClass = position === "right-bottom" ? "items-end" : "items-start"
  const bubbleAlign = position === "right-bottom" ? "self-end" : "self-start"

  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-gradient-to-b from-[--color-bg-soft] to-[--color-bg-primary] p-4">
      <div
        className={cn(
          "relative mx-auto flex h-52 w-full max-w-md flex-col justify-end gap-2 overflow-hidden rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:h-56",
          alignClass,
        )}
      >
        <div className="pointer-events-none absolute inset-x-3 top-3 space-y-1.5">
          <div className="h-2 w-1/3 rounded-full bg-[--color-border]" />
          <div className="h-1.5 w-1/2 rounded-full bg-[--color-border]" />
          <div className="h-1.5 w-2/5 rounded-full bg-[--color-border]" />
        </div>

        {visible ? (
          <>
            <div
              className={cn(
                "relative max-w-[78%] rounded-[16px] px-3 py-2 text-[11px] font-medium",
                bubbleAlign,
              )}
              style={{
                background: swatch.background,
                border: swatch.border,
                boxShadow: swatch.shadow,
                color: swatch.textColor,
              }}
            >
              {badgeName ? (
                <span
                  className="absolute -top-2 left-3 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{
                    background: swatch.badgeBg,
                    color: swatch.badgeColor,
                    border: bubbleTheme === "cute-sticker" ? "1.5px solid #fff" : "1px solid rgba(255,255,255,0.7)",
                  }}
                >
                  {badgeName}
                </span>
              ) : null}
              <span style={{ color: swatch.textColor }}>{caption}</span>
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45"
                style={{
                  background: swatch.tailColor,
                  border: swatch.border,
                  borderTop: "none",
                  borderLeft: "none",
                }}
              />
            </div>
            <div
              className={cn(
                "relative overflow-hidden rounded-full border border-[--color-border] bg-gradient-to-br from-white to-[#eef0f5] shadow-[--shadow-sm]",
                bubbleAlign,
                drag ? "ring-2 ring-dashed ring-[--color-brand-border]" : "",
              )}
              style={{ width: characterSize, height: characterSize }}
            >
              {selectedModel ? (
                <Image
                  src={selectedModel.previewImage}
                  alt={selectedModel.name}
                  fill
                  sizes="120px"
                  quality={70}
                  className="object-cover"
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="self-center text-[12px] text-[--color-text-muted]">{caption}</div>
        )}
      </div>
    </div>
  )
}

export function Live2DSettingsForm({
  initial,
  labels,
}: {
  initial: UserLive2DSettings
  labels: Live2DSettingsLabels
}) {
  const router = useRouter()
  const [displayMode, setDisplayMode] = useState<Live2DDisplayMode>(initial.displayMode)
  const [position, setPosition] = useState<Live2DPosition>(initial.position)
  const [size, setSize] = useState<Live2DSize>(initial.size)
  const [drag, setDrag] = useState<boolean>(initial.drag)
  const [modelId, setModelId] = useState<string>(initial.modelId)
  const [bubbleTheme, setBubbleTheme] = useState<Live2DBubbleTheme>(initial.bubbleTheme)
  const [bubbleName, setBubbleName] = useState<string>(initial.bubbleName)
  const [saving, setSaving] = useState(false)

  const displayModeChanged = displayMode !== initial.displayMode
  const modelChanged = modelId !== initial.modelId
  const needsReload = displayModeChanged || modelChanged
  const dragMayMatter = drag || initial.drag
  const selectedModel = BUILTIN_MODELS.find((m) => m.id === modelId)
  const effectiveBadgeName = bubbleName.trim() || selectedModel?.name || ""

  const previewCaption = useMemo(() => labels.previewHint, [labels.previewHint])

  const themeLabel: Record<Live2DBubbleTheme, string> = {
    "dreamy-glass": labels.bubbleThemeDreamyGlass,
    "cute-sticker": labels.bubbleThemeCuteSticker,
    "minimal-soft": labels.bubbleThemeMinimalSoft,
    "magic-fantasy": labels.bubbleThemeMagicFantasy,
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/live2d/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayMode,
          position,
          size,
          drag,
          modelId,
          bubbleTheme,
          bubbleName: bubbleName.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.saveFailed)
      toast.success(labels.saved)
      if (needsReload) {
        setTimeout(() => window.location.reload(), 400)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  function handleResetPosition() {
    window.__live2dResetPosition?.()
    toast.success(labels.resetPositionDone)
  }

  return (
    <>
      <SettingsSection
        icon={<Monitor size={16} />}
        title={labels.displayMode}
        description={labels.displayModeHint}
      >
        <div className="space-y-5">
          <SettingsRow
            label={labels.displayMode}
            description={labels.displayModeHint}
            align="start"
            control={
              <Segmented<Live2DDisplayMode>
                ariaLabel={labels.displayMode}
                value={displayMode}
                onChange={setDisplayMode}
                options={[
                  { value: "desktop", label: labels.modeDesktop },
                  { value: "all", label: labels.modeAll },
                  { value: "off", label: labels.modeOff },
                ]}
              />
            }
          />

          <SettingsDivider />

          <SettingsRow
            label={labels.position}
            control={
              <Segmented<Live2DPosition>
                ariaLabel={labels.position}
                value={position}
                onChange={setPosition}
                options={[
                  { value: "left-bottom", label: labels.positionLeftBottom },
                  { value: "right-bottom", label: labels.positionRightBottom },
                ]}
              />
            }
          />

          <SettingsDivider />

          <SettingsRow
            label={labels.size}
            control={
              <Segmented<Live2DSize>
                ariaLabel={labels.size}
                value={size}
                onChange={setSize}
                options={[
                  { value: "small", label: labels.sizeSmall },
                  { value: "medium", label: labels.sizeMedium },
                  { value: "large", label: labels.sizeLarge },
                ]}
              />
            }
          />

          <SettingsDivider />

          <SettingsRow
            label={
              <span className="inline-flex items-center gap-1.5">
                <Move3D size={13} className="text-[--color-text-muted]" />
                {labels.drag}
              </span>
            }
            description={labels.dragHint}
            align="start"
            control={
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Segmented<"on" | "off">
                  ariaLabel={labels.drag}
                  value={drag ? "on" : "off"}
                  onChange={(v) => setDrag(v === "on")}
                  options={[
                    { value: "on", label: labels.on },
                    { value: "off", label: labels.off },
                  ]}
                />
                {dragMayMatter ? (
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-1.5 text-[12px] font-medium text-[--color-text-secondary] transition-colors hover:border-[--color-brand-border] hover:text-[--color-text-primary]"
                  >
                    {labels.resetPosition}
                  </button>
                ) : null}
              </div>
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<UserSquare2 size={16} />}
        title={labels.model}
        description={selectedModel?.description ?? labels.modelHint}
      >
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {BUILTIN_MODELS.map((m) => (
            <ModelThumbnail key={m.id} model={m} active={m.id === modelId} onSelect={() => setModelId(m.id)} />
          ))}
        </div>
        {selectedModel ? (
          <div className="mt-4 flex items-center gap-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-soft] px-4 py-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[--color-brand-soft] text-[--color-brand]">
              <Sparkles size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[--color-text-primary]">{selectedModel.name}</div>
              {selectedModel.description ? (
                <div className="mt-0.5 truncate text-[12px] text-[--color-text-secondary]">{selectedModel.description}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        icon={<Layers size={16} />}
        title={labels.bubbleTheme}
        description={labels.bubbleThemeHint}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BUBBLE_THEME_IDS.map((t) => (
              <BubblePreviewCard
                key={t}
                theme={t}
                name={effectiveBadgeName}
                active={bubbleTheme === t}
                label={themeLabel[t]}
                onSelect={() => setBubbleTheme(t)}
                sampleText={labels.previewHint}
              />
            ))}
          </div>

          <SettingsDivider />

          <SettingsRow
            label={
              <span className="inline-flex items-center gap-1.5">
                <Smile size={13} className="text-[--color-text-muted]" />
                {labels.bubbleName}
              </span>
            }
            description={labels.bubbleNameHint}
            align="start"
            control={
              <Input
                value={bubbleName}
                onChange={(e) => setBubbleName(e.target.value)}
                maxLength={BUBBLE_NAME_MAX_LENGTH}
                placeholder={selectedModel?.name ?? labels.bubbleNamePlaceholder}
                className="sm:w-64"
              />
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection icon={<Eye size={16} />} title={labels.preview} description={labels.previewHint}>
        <StagePreview
          displayMode={displayMode}
          position={position}
          size={size}
          drag={drag}
          selectedModel={selectedModel}
          bubbleTheme={bubbleTheme}
          badgeName={effectiveBadgeName}
          caption={previewCaption}
        />
      </SettingsSection>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        {needsReload ? (
          <p className="text-[12px] text-[--color-text-muted] sm:max-w-md">{labels.reloadNote}</p>
        ) : (
          <span />
        )}
        <Button type="button" onClick={handleSave} loading={saving} loadingText={labels.saving} className="sm:w-auto">
          {labels.save}
        </Button>
      </div>
    </>
  )
}

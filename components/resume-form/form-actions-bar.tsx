"use client"

import { Button } from "@/components/ui/button"
import { Save, Hammer, ArrowLeft } from "lucide-react"

export function FormActionsBar({
  savingDraft,
  building,
  statusText,
  onSaveDraft,
  onBuild,
  onBack,
}: {
  savingDraft: boolean
  building: boolean
  statusText?: string
  onSaveDraft: () => void
  onBuild: () => void
  onBack: () => void
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-[--color-border] bg-[--color-bg-surface]/95 px-6 py-4 backdrop-blur-sm lg:-mx-10 lg:px-10">
      {statusText ? (
        <div className="mx-auto mb-3 max-w-[1000px] rounded-[--radius-md] border border-[--color-brand-border] bg-[--color-brand-soft] px-3 py-2 text-xs text-[--color-brand]" aria-live="polite">
          {statusText}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft size={13} /> 返回简历
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onSaveDraft} loading={savingDraft} loadingText="保存中..." className="gap-1.5">
          <Save size={13} />
          保存草稿
        </Button>
        <Button size="sm" onClick={onBuild} loading={building} loadingText="构建中..." className="gap-1.5">
          <Hammer size={13} />
          构建简历
        </Button>
      </div>
    </div>
  )
}

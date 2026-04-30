"use client"

import { useMemo } from "react"
import { checkResumeBuildReadiness } from "@/lib/resume/build-readiness"
import { formStateToResumeJson } from "@/lib/resume/form-transform"
import type { ResumeFormState } from "@/lib/resume/form-types"

interface Props {
  formState: ResumeFormState
  themeSlug: string | null
  themeLabel: string
}

export function TemplateReadinessBanner({ formState, themeSlug, themeLabel }: Props) {
  const report = useMemo(() => {
    const json = formStateToResumeJson(formState)
    return checkResumeBuildReadiness(json, themeSlug)
  }, [formState, themeSlug])

  const score = report.completenessScore
  const scoreStyle =
    score >= 80
      ? "text-[--color-text-primary]"
      : score >= 50
        ? "text-[--color-text-secondary]"
        : "text-[--color-danger]"

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[--color-text-muted] text-xs">当前模板</span>
          <span className="font-semibold">{themeLabel || "默认"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[--color-text-muted]">字段完成度</span>
          <span className={`font-semibold text-sm ${scoreStyle}`}>{score}%</span>
        </div>
      </div>

      {report.missingRequiredFields.length > 0 && (
        <div className="rounded-lg border border-[--color-danger] bg-[--color-danger]/5 px-3 py-2 space-y-0.5">
          {report.missingRequiredFields.map((f, i) => (
            <p key={i} className="text-xs text-[--color-danger]">{f.errorMsg}</p>
          ))}
        </div>
      )}

      {report.missingRecommendedFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[--color-text-muted]">建议补充：</span>
          {report.missingRecommendedFields.slice(0, 6).map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center rounded-full border border-[--color-border] bg-[--color-bg-hover] px-2 py-0.5 text-xs text-[--color-text-secondary]"
            >
              {f.label}
            </span>
          ))}
          {report.missingRecommendedFields.length > 6 && (
            <span className="text-xs text-[--color-text-muted]">
              +{report.missingRecommendedFields.length - 6} 项
            </span>
          )}
        </div>
      )}
    </div>
  )
}

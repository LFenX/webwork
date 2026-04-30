"use client"

import { useState } from "react"
import type { ResumeFormState } from "@/lib/resume/form-types"
import { BasicsSection } from "./basics-section"
import { ProfilesSection } from "./profiles-section"
import { WorkSection } from "./work-section"
import { EducationSection } from "./education-section"
import { ProjectsSection } from "./projects-section"
import { SkillsSection } from "./skills-section"
import { LanguagesSection } from "./languages-section"
import { AwardsSection } from "./awards-section"
import { PublicationsSection } from "./publications-section"
import { InterestsSection } from "./interests-section"
import { VolunteerSection } from "./volunteer-section"
import { ReferencesSection } from "./references-section"

export const DEFAULT_SECTION_ORDER = [
  "basics",
  "profiles",
  "work",
  "education",
  "projects",
  "skills",
  "languages",
  "awards",
  "publications",
  "interests",
  "volunteer",
  "references",
]

const SECTION_LABELS: Record<string, string> = {
  basics: "基本信息",
  profiles: "社交链接",
  work: "工作经历",
  education: "教育经历",
  projects: "项目经历",
  skills: "技能",
  languages: "语言",
  awards: "奖项",
  publications: "出版物",
  interests: "兴趣爱好",
  volunteer: "志愿经历",
  references: "推荐信",
}

interface ResumeFormProps {
  value: ResumeFormState
  onChange: (v: ResumeFormState) => void
  sectionOrder?: string[]
  hiddenSections?: string[]
  fieldLabelMap?: Record<string, string>
}

export function ResumeForm({
  value,
  onChange,
  sectionOrder = DEFAULT_SECTION_ORDER,
  hiddenSections = [],
  fieldLabelMap = {},
}: ResumeFormProps) {
  const [showMore, setShowMore] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasUnknownMeta = value._meta && Object.keys(value._meta).length > 0

  function getSectionTitle(id: string): string {
    return fieldLabelMap[id] ?? SECTION_LABELS[id] ?? id
  }

  const sectionComponents: Record<
    string,
    { component: React.ReactNode; isMore: boolean; isAdvanced: boolean }
  > = {
    basics: {
      component: (
        <BasicsSection
          value={value.basics}
          onChange={(basics) => onChange({ ...value, basics })}
          title={getSectionTitle("basics")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    profiles: {
      component: (
        <ProfilesSection
          values={value.profiles}
          onChange={(profiles) => onChange({ ...value, profiles })}
          title={getSectionTitle("profiles")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    work: {
      component: (
        <WorkSection
          values={value.work}
          onChange={(work) => onChange({ ...value, work })}
          title={getSectionTitle("work")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    education: {
      component: (
        <EducationSection
          values={value.education}
          onChange={(education) => onChange({ ...value, education })}
          title={getSectionTitle("education")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    projects: {
      component: (
        <ProjectsSection
          values={value.projects}
          onChange={(projects) => onChange({ ...value, projects })}
          title={getSectionTitle("projects")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    skills: {
      component: (
        <SkillsSection
          values={value.skills}
          onChange={(skills) => onChange({ ...value, skills })}
          title={getSectionTitle("skills")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    languages: {
      component: (
        <LanguagesSection
          values={value.languages}
          onChange={(languages) => onChange({ ...value, languages })}
          title={getSectionTitle("languages")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    awards: {
      component: (
        <AwardsSection
          values={value.awards}
          onChange={(awards) => onChange({ ...value, awards })}
          title={getSectionTitle("awards")}
        />
      ),
      isMore: false,
      isAdvanced: false,
    },
    publications: {
      component: (
        <PublicationsSection
          values={value.publications}
          onChange={(publications) => onChange({ ...value, publications })}
          title={getSectionTitle("publications")}
        />
      ),
      isMore: true,
      isAdvanced: false,
    },
    interests: {
      component: (
        <InterestsSection
          values={value.interests}
          onChange={(interests) => onChange({ ...value, interests })}
          title={getSectionTitle("interests")}
        />
      ),
      isMore: true,
      isAdvanced: false,
    },
    volunteer: {
      component: (
        <VolunteerSection
          values={value.volunteer}
          onChange={(volunteer) => onChange({ ...value, volunteer })}
          title={getSectionTitle("volunteer")}
        />
      ),
      isMore: false,
      isAdvanced: true,
    },
    references: {
      component: (
        <ReferencesSection
          values={value.references}
          onChange={(references) => onChange({ ...value, references })}
          title={getSectionTitle("references")}
        />
      ),
      isMore: false,
      isAdvanced: true,
    },
  }

  const orderedSections = sectionOrder.filter(
    (id) => id in sectionComponents && !hiddenSections.includes(id)
  )

  const coreSections = orderedSections.filter((id) => !sectionComponents[id].isMore && !sectionComponents[id].isAdvanced)
  const moreSections = orderedSections.filter((id) => sectionComponents[id].isMore)
  const advancedSections = orderedSections.filter((id) => sectionComponents[id].isAdvanced)

  const hasMoreContent =
    value.publications.length > 0 ||
    value.interests.length > 0

  const hasAdvancedContent =
    value.volunteer.length > 0 ||
    value.references.length > 0

  return (
    <div className="space-y-5">
      {/* Core sections rendered in order */}
      {coreSections.map((id) => (
        <div key={id}>{sectionComponents[id].component}</div>
      ))}

      {/* More sections (publications, interests) */}
      {moreSections.length > 0 && (
        <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            <span>
              更多标准字段
              {(hasMoreContent || showMore) && (
                <span className="ml-2 text-xs font-normal text-[--color-text-muted]">
                  出版物 ({value.publications.length}) · 兴趣 ({value.interests.length})
                </span>
              )}
            </span>
            <span className="text-xs text-[--color-text-muted]">{showMore ? "收起" : "展开"}</span>
          </button>
          {showMore && (
            <div className="mt-4 space-y-6">
              {moreSections.map((id) => (
                <div key={id}>{sectionComponents[id].component}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Advanced sections (volunteer, references) */}
      {advancedSections.length > 0 && (
        <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            <span>
              高级字段
              {(hasAdvancedContent || showAdvanced) && (
                <span className="ml-2 text-xs font-normal text-[--color-text-muted]">
                  志愿经历 ({value.volunteer.length}) · 推荐信 ({value.references.length})
                </span>
              )}
            </span>
            <span className="text-xs text-[--color-text-muted]">{showAdvanced ? "收起" : "展开"}</span>
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-6">
              {advancedSections.map((id) => (
                <div key={id}>{sectionComponents[id].component}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Unknown meta fields */}
      {hasUnknownMeta && (
        <details className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold flex items-center justify-between">
            <span>透传字段（不在表单中编辑，保存时原样写回）</span>
            <span className="text-xs font-normal text-[--color-text-muted]">
              {Object.keys(value._meta!).length} 个字段
            </span>
          </summary>
          <div className="border-t border-[--color-border] px-5 pb-4 pt-3 space-y-1">
            <p className="text-xs text-[--color-text-muted] mb-2">
              这些字段不在表单中直接编辑，但会在保存时原样写入简历 JSON。
            </p>
            {Object.entries(value._meta!).map(([key, val]) => (
              <div key={key} className="rounded border border-[--color-border] bg-[--color-bg-hover] px-3 py-2">
                <span className="font-mono text-xs text-[--color-text-secondary]">{key}</span>
                <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-xs text-[--color-text-muted] max-h-16 overflow-y-auto">
                  {JSON.stringify(val, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

import type { ResumeJson } from "./types"

export type ResumeFieldLevel =
  | "core"
  | "recommended"
  | "optional"
  | "advanced"
  | "templateSpecific"

export type ResumeFieldInputType =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "tel"
  | "date"
  | "month"
  | "year"
  | "tag-list"
  | "bullet-list"
  | "image-url"
  | "select"
  | "checkbox"

export interface ResumeFieldDefinition {
  id: string
  section: string
  level: ResumeFieldLevel
  label: string
  inputType: ResumeFieldInputType
  jsonResumeStandard: boolean
  defaultVisible: boolean
  placeholder?: string
  description?: string
}

export const RESUME_FIELD_REGISTRY: ResumeFieldDefinition[] = [
  // ── basics ──────────────────────────────────────────────
  { id: "basics.name",             section: "basics",     level: "core",        label: "姓名",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "你的姓名" },
  { id: "basics.label",            section: "basics",     level: "recommended", label: "目标岗位",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "如：全栈工程师" },
  { id: "basics.email",            section: "basics",     level: "core",        label: "邮箱",           inputType: "email",     jsonResumeStandard: true,  defaultVisible: true,  placeholder: "you@example.com" },
  { id: "basics.phone",            section: "basics",     level: "core",        label: "手机",           inputType: "tel",       jsonResumeStandard: true,  defaultVisible: true,  placeholder: "+86 138..." },
  { id: "basics.summary",          section: "basics",     level: "recommended", label: "个人简介",        inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: true },
  { id: "basics.url",              section: "basics",     level: "optional",    label: "个人网站",        inputType: "url",       jsonResumeStandard: true,  defaultVisible: true,  placeholder: "https://..." },
  { id: "basics.image",            section: "basics",     level: "optional",    label: "头像 URL",        inputType: "image-url", jsonResumeStandard: true,  defaultVisible: true,  placeholder: "头像图片链接" },
  { id: "basics.location.city",    section: "basics",     level: "recommended", label: "城市",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "如：北京" },
  { id: "basics.location.region",  section: "basics",     level: "optional",    label: "地区 / 省份",    inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "如：北京" },
  { id: "basics.location.countryCode", section: "basics", level: "optional",   label: "国家代码",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "CN" },
  { id: "basics.location.address", section: "basics",     level: "advanced",    label: "详细地址",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "basics.location.postalCode", section: "basics",  level: "advanced",   label: "邮编",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  // ── profiles ────────────────────────────────────────────
  { id: "basics.profiles[]",       section: "profiles",   level: "recommended", label: "社交账号",        inputType: "tag-list",  jsonResumeStandard: true,  defaultVisible: true },
  // ── work ────────────────────────────────────────────────
  { id: "work[]",                  section: "work",       level: "recommended", label: "工作经历",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "work[].name",             section: "work",       level: "recommended", label: "公司名称",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "公司" },
  { id: "work[].position",         section: "work",       level: "recommended", label: "职位",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true,  placeholder: "职位" },
  { id: "work[].startDate",        section: "work",       level: "recommended", label: "开始时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "work[].endDate",          section: "work",       level: "optional",    label: "结束时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "work[].summary",          section: "work",       level: "optional",    label: "工作描述",        inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: true },
  { id: "work[].highlights[]",     section: "work",       level: "optional",    label: "亮点",           inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "work[].url",              section: "work",       level: "optional",    label: "公司链接",        inputType: "url",       jsonResumeStandard: true,  defaultVisible: true },
  { id: "work[].location",         section: "work",       level: "advanced",    label: "工作地点",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "work[].description",      section: "work",       level: "advanced",    label: "公司描述",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  // ── education ───────────────────────────────────────────
  { id: "education[]",             section: "education",  level: "recommended", label: "教育经历",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "education[].institution", section: "education",  level: "recommended", label: "学校",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].area",        section: "education",  level: "recommended", label: "专业",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].studyType",   section: "education",  level: "recommended", label: "学历",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].startDate",   section: "education",  level: "recommended", label: "开始时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].endDate",     section: "education",  level: "optional",    label: "结束时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].url",         section: "education",  level: "optional",    label: "学校链接",        inputType: "url",       jsonResumeStandard: true,  defaultVisible: true },
  { id: "education[].score",       section: "education",  level: "advanced",    label: "绩点 / 成绩",     inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "education[].courses[]",   section: "education",  level: "advanced",    label: "主修课程",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  // ── projects ────────────────────────────────────────────
  { id: "projects[]",              section: "projects",   level: "optional",    label: "项目经历",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "projects[].name",         section: "projects",   level: "optional",    label: "项目名称",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].description",  section: "projects",   level: "optional",    label: "项目描述",        inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].url",          section: "projects",   level: "optional",    label: "项目链接",        inputType: "url",       jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].keywords[]",   section: "projects",   level: "optional",    label: "关键词",          inputType: "tag-list",  jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].highlights[]", section: "projects",   level: "optional",    label: "亮点",           inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "projects[].startDate",    section: "projects",   level: "optional",    label: "开始时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].endDate",      section: "projects",   level: "optional",    label: "结束时间",        inputType: "month",     jsonResumeStandard: true,  defaultVisible: true },
  { id: "projects[].roles[]",      section: "projects",   level: "advanced",    label: "角色",           inputType: "tag-list",  jsonResumeStandard: true,  defaultVisible: false },
  { id: "projects[].entity",       section: "projects",   level: "advanced",    label: "所属机构",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "projects[].type",         section: "projects",   level: "advanced",    label: "项目类型",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  // ── skills ──────────────────────────────────────────────
  { id: "skills[]",                section: "skills",     level: "recommended", label: "技能",           inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "skills[].name",           section: "skills",     level: "recommended", label: "技能名称",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "skills[].level",          section: "skills",     level: "optional",    label: "熟练程度",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "skills[].keywords[]",     section: "skills",     level: "optional",    label: "技能关键词",      inputType: "tag-list",  jsonResumeStandard: true,  defaultVisible: true },
  // ── languages ───────────────────────────────────────────
  { id: "languages[]",             section: "languages",  level: "optional",    label: "语言能力",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "languages[].language",    section: "languages",  level: "optional",    label: "语言",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "languages[].fluency",     section: "languages",  level: "optional",    label: "熟练程度",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  // ── awards ──────────────────────────────────────────────
  { id: "awards[]",                section: "awards",     level: "optional",    label: "奖项",           inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: true },
  { id: "awards[].title",          section: "awards",     level: "optional",    label: "奖项名称",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "awards[].date",           section: "awards",     level: "optional",    label: "获奖时间",        inputType: "date",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "awards[].awarder",        section: "awards",     level: "optional",    label: "颁奖机构",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: true },
  { id: "awards[].summary",        section: "awards",     level: "optional",    label: "描述",           inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: true },
  // ── publications ────────────────────────────────────────
  { id: "publications[]",              section: "publications", level: "advanced", label: "出版物",      inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  { id: "publications[].name",         section: "publications", level: "advanced", label: "名称",        inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "publications[].publisher",    section: "publications", level: "advanced", label: "出版商",      inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "publications[].releaseDate",  section: "publications", level: "advanced", label: "发布日期",    inputType: "date",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "publications[].url",          section: "publications", level: "advanced", label: "链接",        inputType: "url",       jsonResumeStandard: true,  defaultVisible: false },
  { id: "publications[].summary",      section: "publications", level: "advanced", label: "摘要",        inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: false },
  // ── interests ───────────────────────────────────────────
  { id: "interests[]",             section: "interests",  level: "advanced",    label: "兴趣爱好",        inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  { id: "interests[].name",        section: "interests",  level: "advanced",    label: "名称",           inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "interests[].keywords[]",  section: "interests",  level: "advanced",    label: "关键词",          inputType: "tag-list",  jsonResumeStandard: true,  defaultVisible: false },
  // ── volunteer ───────────────────────────────────────────
  { id: "volunteer[]",                 section: "volunteer",   level: "advanced", label: "志愿经历",      inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  { id: "volunteer[].organization",    section: "volunteer",   level: "advanced", label: "组织",          inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].position",        section: "volunteer",   level: "advanced", label: "职位",          inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].url",             section: "volunteer",   level: "advanced", label: "链接",          inputType: "url",       jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].startDate",       section: "volunteer",   level: "advanced", label: "开始时间",      inputType: "month",     jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].endDate",         section: "volunteer",   level: "advanced", label: "结束时间",      inputType: "month",     jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].summary",         section: "volunteer",   level: "advanced", label: "描述",          inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: false },
  { id: "volunteer[].highlights[]",    section: "volunteer",   level: "advanced", label: "亮点",          inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  // ── references ──────────────────────────────────────────
  { id: "references[]",            section: "references", level: "advanced",    label: "推荐信",          inputType: "bullet-list", jsonResumeStandard: true, defaultVisible: false },
  { id: "references[].name",       section: "references", level: "advanced",    label: "推荐人",          inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  { id: "references[].reference",  section: "references", level: "advanced",    label: "推荐内容",        inputType: "textarea",  jsonResumeStandard: true,  defaultVisible: false },
  // ── meta ────────────────────────────────────────────────
  { id: "meta",                    section: "meta",       level: "advanced",    label: "元信息 (meta)",   inputType: "text",      jsonResumeStandard: true,  defaultVisible: false },
  // ── templateSpecific ────────────────────────────────────
  { id: "work[].startDateYear",    section: "work",       level: "templateSpecific", label: "开始年份（衍生）", inputType: "year", jsonResumeStandard: false, defaultVisible: false },
  { id: "work[].endDateYear",      section: "work",       level: "templateSpecific", label: "结束年份（衍生）", inputType: "year", jsonResumeStandard: false, defaultVisible: false },
]

// ── Lookup helpers ──────────────────────────────────────────────────────────

export const RESUME_FIELD_MAP = new Map<string, ResumeFieldDefinition>(
  RESUME_FIELD_REGISTRY.map((f) => [f.id, f]),
)

export function getFieldsBySection(section: string): ResumeFieldDefinition[] {
  return RESUME_FIELD_REGISTRY.filter((f) => f.section === section)
}

export function getFieldsByLevel(level: ResumeFieldLevel): ResumeFieldDefinition[] {
  return RESUME_FIELD_REGISTRY.filter((f) => f.level === level)
}

// ── hasFieldValue ───────────────────────────────────────────────────────────

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  const parts = path.split(".")
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function isNonEmpty(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === "string") return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "object") return Object.keys(v as object).length > 0
  return Boolean(v)
}

/**
 * Check whether a field has a non-empty value in the given resumeJson.
 *
 * ID formats supported:
 *   "basics.name"           — scalar nested field
 *   "work[]"                — section-level array (non-empty)
 *   "basics.profiles[]"     — nested array (non-empty)
 *   "work[].position"       — at least one item in the array has the field
 *   "basics.profiles[].url" — at least one profile item has url
 */
export function hasFieldValue(resumeJson: ResumeJson, fieldId: string): boolean {
  const json = resumeJson as Record<string, unknown>

  // Array-item field: "section[].field" or "outer.inner[].field"
  if (fieldId.includes("[].")) {
    const arrayEndIdx = fieldId.indexOf("[].")
    const arrayPath = fieldId.slice(0, arrayEndIdx)
    const fieldPath = fieldId.slice(arrayEndIdx + 3)
    const arr = getValueAtPath(json, arrayPath)
    if (!Array.isArray(arr) || arr.length === 0) return false
    return arr.some((item) => isNonEmpty(getValueAtPath(item as Record<string, unknown>, fieldPath)))
  }

  // Section-level array: ends with "[]"
  if (fieldId.endsWith("[]")) {
    const arrayPath = fieldId.slice(0, -2)
    const arr = getValueAtPath(json, arrayPath)
    return Array.isArray(arr) && arr.length > 0
  }

  // Scalar (potentially nested): "basics.name", "basics.location.city", "meta"
  return isNonEmpty(getValueAtPath(json, fieldId))
}

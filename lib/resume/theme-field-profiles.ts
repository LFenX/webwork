export interface ThemeFieldProfile {
  slug: string
  displayName: string
  /** 缺失这些字段时 canBuild = false（由 build-readiness 中的固定规则决定，此处仅扩展） */
  requiredFields: string[]
  /** 缺失时只提示，不阻止构建 */
  recommendedFields: string[]
  /** 该主题不会用到的字段（UI 可以降级展示，但不删除数据） */
  unsupportedFields: string[]
  notes?: string
}

// ── Default profile（无 profile 的主题走这里）───────────────────────────────
export const DEFAULT_THEME_FIELD_PROFILE: ThemeFieldProfile = {
  slug: "default",
  displayName: "默认",
  requiredFields: [],
  recommendedFields: [
    "basics.label",
    "basics.summary",
    "work[]",
    "education[]",
    "skills[]",
  ],
  unsupportedFields: [],
}

// ── Per-theme profiles ────────────────────────────────────────────────────────

const THEME_FIELD_PROFILES_LIST: ThemeFieldProfile[] = [
  {
    slug: "elegant",
    displayName: "Elegant",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "basics.profiles[]",
      "work[]",
      "education[]",
      "skills[]",
      "skills[].keywords[]",
    ],
    unsupportedFields: [],
    notes: "侧栏主题，社交账号 (profiles) 和技能 (skills) 会显著丰富侧栏效果",
  },
  {
    slug: "stackoverflow",
    displayName: "Stack Overflow",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "basics.profiles[]",
      "work[]",
      "work[].highlights[]",
      "projects[]",
      "skills[]",
      "skills[].keywords[]",
    ],
    unsupportedFields: [],
    notes: "突出项目 (projects) 和工作亮点 (highlights)，社交账号显示在顶部",
  },
  {
    slug: "engineering",
    displayName: "Engineering",
    requiredFields: [],
    recommendedFields: [
      "basics.summary",
      "work[]",
      "skills[]",
      "skills[].keywords[]",
      "projects[]",
      "projects[].keywords[]",
    ],
    unsupportedFields: ["awards[]", "publications[]", "volunteer[]"],
    notes: "技术简洁风，重视技能和项目，不展示奖项和出版物",
  },
  {
    slug: "flat",
    displayName: "Flat",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "work[]",
      "education[]",
      "skills[]",
    ],
    unsupportedFields: [],
    notes: "清爽单栏设计，信息清晰即可",
  },
  {
    slug: "kendall",
    displayName: "Kendall",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.image",
      "basics.profiles[]",
      "work[]",
      "skills[]",
      "skills[].keywords[]",
    ],
    unsupportedFields: [],
    notes: "侧栏设计，头像 (image) 和技能列表在侧栏展示效果好",
  },
  {
    slug: "macchiato",
    displayName: "Macchiato",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "basics.profiles[]",
      "work[]",
      "education[]",
      "skills[]",
      "skills[].keywords[]",
    ],
    unsupportedFields: [],
    notes: "深色主题，信息密度较高，适合经验丰富的求职者",
  },
  {
    slug: "paper",
    displayName: "Paper",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "work[]",
      "work[].summary",
      "education[]",
    ],
    unsupportedFields: ["basics.profiles[]"],
    notes: "经典白纸风格，工作描述 (summary) 和教育背景是展示重点",
  },
  {
    slug: "paper_cn",
    displayName: "Paper 中文",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "work[]",
      "work[].summary",
      "education[]",
    ],
    unsupportedFields: ["basics.profiles[]"],
    notes: "中文白纸风格，工作描述和教育背景是展示重点",
  },
  {
    slug: "tech",
    displayName: "Tech",
    requiredFields: [],
    recommendedFields: [
      "basics.summary",
      "work[]",
      "work[].highlights[]",
      "skills[]",
      "skills[].keywords[]",
      "projects[]",
    ],
    unsupportedFields: [],
    notes: "技术岗专用，重视技能关键词和项目经历",
  },
  {
    slug: "academic",
    displayName: "Academic",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.summary",
      "education[]",
      "education[].score",
      "awards[]",
      "publications[]",
    ],
    unsupportedFields: ["basics.profiles[]"],
    notes: "学术风格，重点展示教育背景、奖项和出版物",
  },
  // kendall-web inherits from kendall logic
  {
    slug: "kendall-web",
    displayName: "Kendall Web",
    requiredFields: [],
    recommendedFields: [
      "basics.label",
      "basics.image",
      "basics.profiles[]",
      "work[]",
      "skills[]",
      "skills[].keywords[]",
    ],
    unsupportedFields: [],
  },
]

// ── Lookup ────────────────────────────────────────────────────────────────────

const PROFILES_MAP = new Map<string, ThemeFieldProfile>(
  THEME_FIELD_PROFILES_LIST.map((p) => [p.slug, p]),
)

export function getThemeFieldProfile(slug: string | null | undefined): ThemeFieldProfile {
  if (!slug) return DEFAULT_THEME_FIELD_PROFILE
  return PROFILES_MAP.get(slug) ?? { ...DEFAULT_THEME_FIELD_PROFILE, slug, displayName: slug }
}

export function getAllThemeFieldProfiles(): ThemeFieldProfile[] {
  return THEME_FIELD_PROFILES_LIST
}

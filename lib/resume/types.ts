export interface ResumeBasicsLocation {
  address?: string; postalCode?: string; city?: string; countryCode?: string; region?: string
}
export interface ResumeBasicsProfile {
  network?: string; username?: string; url?: string
}
export interface ResumeBasics {
  name?: string; label?: string; image?: string; email?: string; phone?: string;
  url?: string; summary?: string; location?: ResumeBasicsLocation; profiles?: ResumeBasicsProfile[]
  [key: string]: unknown
}

export interface ResumeWork {
  name?: string; company?: string; position?: string; url?: string;
  startDate?: string; endDate?: string; summary?: string; highlights?: string[]
  [key: string]: unknown
}
export interface ResumeEducation {
  institution?: string; url?: string; area?: string; studyType?: string;
  startDate?: string; endDate?: string; score?: string; courses?: string[]
  [key: string]: unknown
}
export interface ResumeSkill { name?: string; level?: string; keywords?: string[]; [key: string]: unknown }
export interface ResumeProject {
  name?: string; description?: string; highlights?: string[]; keywords?: string[];
  startDate?: string; endDate?: string; url?: string; roles?: string[]; entity?: string; type?: string
  [key: string]: unknown
}

export interface ResumeJson {
  basics?: ResumeBasics
  work?: ResumeWork[]
  education?: ResumeEducation[]
  skills?: ResumeSkill[]
  projects?: ResumeProject[]
  awards?: unknown[]
  publications?: unknown[]
  volunteer?: unknown[]
  languages?: unknown[]
  interests?: unknown[]
  references?: unknown[]
  meta?: Record<string, unknown>
  [key: string]: unknown
}

export interface ResumeThemeInfo {
  slug: string
  pkg: string
  version: string
  description: string
  label: string
  tags: string[]
  recommendedFor?: string
  sortKey: number
  available: boolean
  unavailableReason?: string
}

export type ResumeRenderResult =
  | { ok: true; html: string; usedTheme: ResumeThemeInfo; fallback: boolean }
  | { ok: false; code: "no_themes" | "render_failed" | "invalid_json"; error: string }

import type { ResumeJson } from "./types"
import type {
  ResumeFormState, BasicsForm, ProfileForm, WorkForm, EducationForm,
  ProjectForm, SkillForm, LanguageForm, AwardForm, PublicationForm, InterestForm,
  VolunteerForm, ReferenceForm,
} from "./form-types"

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

function cleanStrings(list: string[]): string[] {
  return list.filter((s) => s.trim().length > 0)
}

export function resumeJsonToFormState(json: ResumeJson): ResumeFormState {
  const b = (json.basics ?? {}) as Record<string, unknown>
  const loc = (b.location ?? {}) as Record<string, unknown>

  const basics: BasicsForm = {
    name: str(b.name),
    label: str(b.label),
    email: str(b.email),
    phone: str(b.phone),
    url: str(b.url),
    image: str(b.image),
    summary: str(b.summary),
    city: str(loc.city),
    region: str(loc.region),
    countryCode: str(loc.countryCode),
  }

  const profiles: ProfileForm[] = (Array.isArray(b.profiles) ? b.profiles : []).map((p: unknown) => {
    const o = p as Record<string, unknown>
    return { network: str(o.network), username: str(o.username), url: str(o.url) }
  })

  const work: WorkForm[] = (Array.isArray(json.work) ? json.work : []).map((w: unknown) => {
    const o = w as Record<string, unknown>
    return {
      name: str(o.name ?? o.company),
      position: str(o.position),
      url: str(o.url),
      startDate: str(o.startDate),
      endDate: str(o.endDate),
      current: false,
      summary: str(o.summary),
      highlights: arr(o.highlights),
      description: str(o.description),
      location: str(o.location),
    }
  })

  const education: EducationForm[] = (Array.isArray(json.education) ? json.education : []).map((e: unknown) => {
    const o = e as Record<string, unknown>
    return {
      institution: str(o.institution),
      url: str(o.url),
      area: str(o.area),
      studyType: str(o.studyType),
      startDate: str(o.startDate),
      endDate: str(o.endDate),
      score: str(o.score),
      courses: arr(o.courses),
    }
  })

  const projects: ProjectForm[] = (Array.isArray(json.projects) ? json.projects : []).map((p: unknown) => {
    const o = p as Record<string, unknown>
    return {
      name: str(o.name),
      description: str(o.description),
      url: str(o.url),
      startDate: str(o.startDate),
      endDate: str(o.endDate),
      keywords: arr(o.keywords),
      highlights: arr(o.highlights),
      roles: arr(o.roles),
      entity: str(o.entity),
      type: str(o.type),
    }
  })

  const skills: SkillForm[] = (Array.isArray(json.skills) ? json.skills : []).map((s: unknown) => {
    const o = s as Record<string, unknown>
    return { name: str(o.name), level: str(o.level), keywords: arr(o.keywords) }
  })

  const languages: LanguageForm[] = (Array.isArray(json.languages) ? json.languages : []).map((l: unknown) => {
    const o = l as Record<string, unknown>
    return { language: str(o.language), fluency: str(o.fluency) }
  })

  const awards: AwardForm[] = (Array.isArray(json.awards) ? json.awards : []).map((a: unknown) => {
    const o = a as Record<string, unknown>
    return { title: str(o.title), date: str(o.date), awarder: str(o.awarder), summary: str(o.summary) }
  })

  const publications: PublicationForm[] = (Array.isArray(json.publications) ? json.publications : []).map((p: unknown) => {
    const o = p as Record<string, unknown>
    return { name: str(o.name), publisher: str(o.publisher), releaseDate: str(o.releaseDate), url: str(o.url), summary: str(o.summary) }
  })

  const interests: InterestForm[] = (Array.isArray(json.interests) ? json.interests : []).map((i: unknown) => {
    const o = i as Record<string, unknown>
    return { name: str(o.name), keywords: arr(o.keywords) }
  })

  const volunteer: VolunteerForm[] = (Array.isArray(json.volunteer) ? json.volunteer : []).map((v: unknown) => {
    const o = v as Record<string, unknown>
    return {
      organization: str(o.organization),
      position: str(o.position),
      url: str(o.url),
      startDate: str(o.startDate),
      endDate: str(o.endDate),
      current: false,
      summary: str(o.summary),
      highlights: arr(o.highlights),
    }
  })

  const references: ReferenceForm[] = (Array.isArray(json.references) ? json.references : []).map((r: unknown) => {
    const o = r as Record<string, unknown>
    return { name: str(o.name), reference: str(o.reference) }
  })

  // Preserve unknown top-level keys for round-trip safety.
  // Note: "meta" is intentionally NOT in knownKeys so the JSON Resume meta
  // object (canonical/version/lastModified) is also preserved here.
  const knownKeys = new Set([
    "basics", "work", "education", "projects", "skills", "languages",
    "awards", "publications", "interests", "volunteer", "references",
  ])
  const _meta: Record<string, unknown> = {}
  for (const key of Object.keys(json)) {
    if (!knownKeys.has(key)) _meta[key] = (json as Record<string, unknown>)[key]
  }

  const state: ResumeFormState = {
    basics, profiles, work, education, projects, skills, languages,
    awards, publications, interests, volunteer, references,
  }
  if (Object.keys(_meta).length > 0) state._meta = _meta
  return state
}

// ─── Form → JSON Resume ─────────────────────────────────────────────────────

function trim(v: string): string { return v.trim() }
function has(v: string): boolean { return v.trim().length > 0 }

function normalizeUrl(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try { new URL(s); return s } catch { return null }
  }
  try { new URL(`https://${s}`); return `https://${s}` } catch { return null }
}

function normalizeDate(v: string): string {
  const s = v.trim()
  if (!s) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  return s
}

export function formStateToResumeJson(state: ResumeFormState): ResumeJson {
  const { basics, profiles, work, education, projects, skills, languages, awards, publications, interests, volunteer, references, _meta } = state

  const loc: Record<string, string> = {}
  if (has(basics.city)) loc.city = trim(basics.city)
  if (has(basics.region)) loc.region = trim(basics.region)
  if (has(basics.countryCode)) loc.countryCode = trim(basics.countryCode)

  const basicsOut: Record<string, unknown> = {}
  if (has(basics.name)) basicsOut.name = trim(basics.name)
  if (has(basics.label)) basicsOut.label = trim(basics.label)
  if (has(basics.email)) basicsOut.email = trim(basics.email)
  if (has(basics.phone)) basicsOut.phone = trim(basics.phone)
  if (has(basics.summary)) basicsOut.summary = trim(basics.summary)

  const urlNorm = normalizeUrl(basics.url)
  if (urlNorm) basicsOut.url = urlNorm
  const imageNorm = normalizeUrl(basics.image)
  if (imageNorm) basicsOut.image = imageNorm

  if (Object.keys(loc).length > 0) basicsOut.location = loc

  const cleanProfiles = profiles
    .map((p) => {
      const out: Record<string, string> = {}
      if (has(p.network)) out.network = trim(p.network)
      if (has(p.username)) out.username = trim(p.username)
      const u = normalizeUrl(p.url)
      if (u) out.url = u
      return out
    })
    .filter((p) => Object.keys(p).length > 0)
  if (cleanProfiles.length > 0) basicsOut.profiles = cleanProfiles

  const json: Record<string, unknown> = {}
  if (Object.keys(basicsOut).length > 0) json.basics = basicsOut

  function setIfNonEmpty(key: string, items: Record<string, unknown>[]) {
    const filtered = items.filter((o) => Object.keys(o).length > 0)
    if (filtered.length > 0) json[key] = filtered
  }

  setIfNonEmpty("work", work.map((w) => {
    const o: Record<string, unknown> = {}
    if (has(w.name)) o.name = trim(w.name)
    if (has(w.position)) o.position = trim(w.position)
    const u = normalizeUrl(w.url)
    if (u) o.url = u
    if (has(w.startDate)) o.startDate = normalizeDate(w.startDate)
    if (has(w.endDate)) o.endDate = normalizeDate(w.endDate)
    if (has(w.summary)) o.summary = trim(w.summary)
    if (has(w.description)) o.description = trim(w.description)
    if (has(w.location)) o.location = trim(w.location)
    const h = cleanStrings(w.highlights)
    if (h.length > 0) o.highlights = h
    return o
  }))

  setIfNonEmpty("education", education.map((e) => {
    const o: Record<string, unknown> = {}
    if (has(e.institution)) o.institution = trim(e.institution)
    const u = normalizeUrl(e.url)
    if (u) o.url = u
    if (has(e.area)) o.area = trim(e.area)
    if (has(e.studyType)) o.studyType = trim(e.studyType)
    if (has(e.startDate)) o.startDate = normalizeDate(e.startDate)
    if (has(e.endDate)) o.endDate = normalizeDate(e.endDate)
    if (has(e.score)) o.score = trim(e.score)
    const c = cleanStrings(e.courses)
    if (c.length > 0) o.courses = c
    return o
  }))

  setIfNonEmpty("projects", projects.map((p) => {
    const o: Record<string, unknown> = {}
    if (has(p.name)) o.name = trim(p.name)
    if (has(p.description)) o.description = trim(p.description)
    const u = normalizeUrl(p.url)
    if (u) o.url = u
    if (has(p.startDate)) o.startDate = normalizeDate(p.startDate)
    if (has(p.endDate)) o.endDate = normalizeDate(p.endDate)
    if (has(p.entity)) o.entity = trim(p.entity)
    if (has(p.type)) o.type = trim(p.type)
    const kw = cleanStrings(p.keywords)
    if (kw.length > 0) o.keywords = kw
    const h = cleanStrings(p.highlights)
    if (h.length > 0) o.highlights = h
    const r = cleanStrings(p.roles)
    if (r.length > 0) o.roles = r
    return o
  }))

  setIfNonEmpty("skills", skills.map((s) => {
    const o: Record<string, unknown> = {}
    if (has(s.name)) o.name = trim(s.name)
    if (has(s.level)) o.level = trim(s.level)
    const kw = cleanStrings(s.keywords)
    if (kw.length > 0) o.keywords = kw
    return o
  }))

  setIfNonEmpty("languages", languages.map((l) => {
    const o: Record<string, unknown> = {}
    if (has(l.language)) o.language = trim(l.language)
    if (has(l.fluency)) o.fluency = trim(l.fluency)
    return o
  }))

  setIfNonEmpty("awards", awards.map((a) => {
    const o: Record<string, unknown> = {}
    if (has(a.title)) o.title = trim(a.title)
    if (has(a.date)) o.date = normalizeDate(a.date)
    if (has(a.awarder)) o.awarder = trim(a.awarder)
    if (has(a.summary)) o.summary = trim(a.summary)
    return o
  }))

  setIfNonEmpty("publications", publications.map((p) => {
    const o: Record<string, unknown> = {}
    if (has(p.name)) o.name = trim(p.name)
    if (has(p.publisher)) o.publisher = trim(p.publisher)
    if (has(p.releaseDate)) o.releaseDate = normalizeDate(p.releaseDate)
    const u = normalizeUrl(p.url)
    if (u) o.url = u
    if (has(p.summary)) o.summary = trim(p.summary)
    return o
  }))

  setIfNonEmpty("interests", interests.map((i) => {
    const o: Record<string, unknown> = {}
    if (has(i.name)) o.name = trim(i.name)
    const kw = cleanStrings(i.keywords)
    if (kw.length > 0) o.keywords = kw
    return o
  }))

  setIfNonEmpty("volunteer", volunteer.map((v) => {
    const o: Record<string, unknown> = {}
    if (has(v.organization)) o.organization = trim(v.organization)
    if (has(v.position)) o.position = trim(v.position)
    const u = normalizeUrl(v.url)
    if (u) o.url = u
    if (has(v.startDate)) o.startDate = normalizeDate(v.startDate)
    if (has(v.endDate)) o.endDate = normalizeDate(v.endDate)
    if (has(v.summary)) o.summary = trim(v.summary)
    const h = cleanStrings(v.highlights)
    if (h.length > 0) o.highlights = h
    return o
  }))

  setIfNonEmpty("references", references.map((r) => {
    const o: Record<string, unknown> = {}
    if (has(r.name)) o.name = trim(r.name)
    if (has(r.reference)) o.reference = trim(r.reference)
    return o
  }))

  // Restore unknown top-level keys (includes JSON Resume "meta" object)
  if (_meta) {
    for (const key of Object.keys(_meta)) {
      if (json[key] === undefined) json[key] = _meta[key]
    }
  }

  return json as ResumeJson
}

export interface BasicsForm {
  name: string
  label: string
  email: string
  phone: string
  url: string
  image: string
  summary: string
  city: string
  region: string
  countryCode: string
}

export interface ProfileForm {
  network: string
  username: string
  url: string
}

export interface WorkForm {
  name: string
  position: string
  url: string
  startDate: string
  endDate: string
  current: boolean
  summary: string
  highlights: string[]
  description: string
  location: string
}

export interface EducationForm {
  institution: string
  url: string
  area: string
  studyType: string
  startDate: string
  endDate: string
  score: string
  courses: string[]
}

export interface ProjectForm {
  name: string
  description: string
  url: string
  startDate: string
  endDate: string
  keywords: string[]
  highlights: string[]
  roles: string[]
  entity: string
  type: string
}

export interface SkillForm {
  name: string
  level: string
  keywords: string[]
}

export interface LanguageForm {
  language: string
  fluency: string
}

export interface AwardForm {
  title: string
  date: string
  awarder: string
  summary: string
}

export interface PublicationForm {
  name: string
  publisher: string
  releaseDate: string
  url: string
  summary: string
}

export interface InterestForm {
  name: string
  keywords: string[]
}

export interface VolunteerForm {
  organization: string
  position: string
  url: string
  startDate: string
  endDate: string
  current: boolean
  summary: string
  highlights: string[]
}

export interface ReferenceForm {
  name: string
  reference: string
}

export interface ResumeFormState {
  basics: BasicsForm
  profiles: ProfileForm[]
  work: WorkForm[]
  education: EducationForm[]
  projects: ProjectForm[]
  skills: SkillForm[]
  languages: LanguageForm[]
  awards: AwardForm[]
  publications: PublicationForm[]
  interests: InterestForm[]
  volunteer: VolunteerForm[]
  references: ReferenceForm[]
  /** Unknown top-level JSON Resume keys — preserved for round-trip safety. */
  _meta?: Record<string, unknown>
}

export function emptyBasics(): BasicsForm {
  return { name: "", label: "", email: "", phone: "", url: "", image: "", summary: "", city: "", region: "", countryCode: "" }
}

export function emptyProfile(): ProfileForm {
  return { network: "", username: "", url: "" }
}

export function emptyWork(): WorkForm {
  return { name: "", position: "", url: "", startDate: "", endDate: "", current: false, summary: "", highlights: [], description: "", location: "" }
}

export function emptyEducation(): EducationForm {
  return { institution: "", url: "", area: "", studyType: "", startDate: "", endDate: "", score: "", courses: [] }
}

export function emptyProject(): ProjectForm {
  return { name: "", description: "", url: "", startDate: "", endDate: "", keywords: [], highlights: [], roles: [], entity: "", type: "" }
}

export function emptySkill(): SkillForm {
  return { name: "", level: "", keywords: [] }
}

export function emptyLanguage(): LanguageForm {
  return { language: "", fluency: "" }
}

export function emptyAward(): AwardForm {
  return { title: "", date: "", awarder: "", summary: "" }
}

export function emptyPublication(): PublicationForm {
  return { name: "", publisher: "", releaseDate: "", url: "", summary: "" }
}

export function emptyInterest(): InterestForm {
  return { name: "", keywords: [] }
}

export function emptyVolunteer(): VolunteerForm {
  return { organization: "", position: "", url: "", startDate: "", endDate: "", current: false, summary: "", highlights: [] }
}

export function emptyReference(): ReferenceForm {
  return { name: "", reference: "" }
}

export function emptyFormState(): ResumeFormState {
  return {
    basics: emptyBasics(),
    profiles: [],
    work: [],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    awards: [],
    publications: [],
    interests: [],
    volunteer: [],
    references: [],
  }
}

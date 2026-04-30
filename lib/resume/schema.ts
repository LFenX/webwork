import "server-only"
import { z } from "zod"
import type { ResumeJson } from "./types"

const profile = z.object({
  network: z.string().optional(), username: z.string().optional(), url: z.string().optional(),
}).passthrough()

const basics = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  url: z.string().optional(),
  summary: z.string().optional(),
  location: z.object({
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    countryCode: z.string().optional(),
    region: z.string().optional(),
  }).passthrough().optional(),
  profiles: z.array(profile).optional(),
}).passthrough()

export const resumeJsonZ = z.object({
  basics: basics.optional(),
  work: z.array(z.object({}).passthrough()).optional(),
  education: z.array(z.object({}).passthrough()).optional(),
  skills: z.array(z.object({}).passthrough()).optional(),
  projects: z.array(z.object({}).passthrough()).optional(),
  awards: z.array(z.object({}).passthrough()).optional(),
  publications: z.array(z.object({}).passthrough()).optional(),
  volunteer: z.array(z.object({}).passthrough()).optional(),
  languages: z.array(z.object({}).passthrough()).optional(),
  interests: z.array(z.object({}).passthrough()).optional(),
  references: z.array(z.object({}).passthrough()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

export const RESUME_JSON_MAX_BYTES = 200 * 1024

export function parseResumeJson(input: unknown):
  | { ok: true; data: ResumeJson }
  | { ok: false; issues: string[] } {
  const serialized = JSON.stringify(input ?? {})
  if (Buffer.byteLength(serialized, "utf8") > RESUME_JSON_MAX_BYTES) {
    return { ok: false, issues: [`resumeJson 超过 ${RESUME_JSON_MAX_BYTES} 字节上限`] }
  }
  const r = resumeJsonZ.safeParse(input)
  if (!r.success) return { ok: false, issues: r.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) }
  return { ok: true, data: r.data as ResumeJson }
}

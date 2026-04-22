import "server-only"

export type RequestMeta = {
  ipAddress: string
  geoLocation: string
  deviceInfo: string
}

type RequestLike = {
  headers: Headers
}

const geoCache = new Map<string, string>()

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)
    if (value) return value
  }
  return ""
}

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isPrivateOrLocalIp(ipAddress: string) {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|::1|localhost|fc00:|fd00:|fe80:)/i.test(ipAddress)
}

function shouldEnrichGeoLocation(location: string) {
  const trimmed = (location || "").trim()
  if (!trimmed || trimmed === "未知") return true
  if (trimmed === "本地/内网") return false
  return !trimmed.includes(" / ")
}

export function getClientIp(headers: Headers) {
  const forwarded = firstHeader(headers, ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"])
  const ip = forwarded.split(",")[0]?.trim() ?? ""
  return ip || "未知"
}

export function getGeoLocation(headers: Headers, ipAddress: string) {
  if (isPrivateOrLocalIp(ipAddress)) {
    return "本地/内网"
  }

  const country = firstHeader(headers, ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"])
  const region = firstHeader(headers, ["x-vercel-ip-country-region", "cf-region", "x-region", "x-vercel-ip-region"])
  const city = firstHeader(headers, ["x-vercel-ip-city", "cf-ipcity", "x-city"])
  const location = [country, region, city].filter(Boolean).map(decodeHeaderValue).join(" / ")
  return location || "未知"
}

function normalizePublicLocation(country?: string, region?: string, city?: string) {
  const parts = [country, region, city]
    .map((part) => (part || "").trim())
    .filter(Boolean)
  return Array.from(new Set(parts)).join(" / ")
}

async function fetchIpWhoLocation(ipAddress: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}?lang=zh-CN`, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) return ""
    const data = (await response.json()) as {
      success?: boolean
      country?: string
      region?: string
      city?: string
    }
    if (data.success === false) return ""
    return normalizePublicLocation(data.country, data.region, data.city)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchIpApiLocation(ipAddress: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?lang=zh-CN&fields=status,country,regionName,city`,
      { cache: "no-store", signal: controller.signal }
    )
    if (!response.ok) return ""
    const data = (await response.json()) as {
      status?: string
      country?: string
      regionName?: string
      city?: string
    }
    if (data.status !== "success") return ""
    return normalizePublicLocation(data.country, data.regionName, data.city)
  } finally {
    clearTimeout(timeout)
  }
}

export async function lookupPublicGeoLocation(ipAddress: string) {
  if (!ipAddress || ipAddress === "未知" || isPrivateOrLocalIp(ipAddress)) return ""
  const cached = geoCache.get(ipAddress)
  if (cached !== undefined) return cached

  const providers = [fetchIpWhoLocation, fetchIpApiLocation]
  for (const provider of providers) {
    try {
      const location = await provider(ipAddress)
      if (!location) continue
      geoCache.set(ipAddress, location)
      return location
    } catch {
      // Try the next public source before falling back to the stored value.
    }
  }
  return ""
}

export async function lookupChinaIpGeoLocation(ipAddress: string) {
  const location = await lookupPublicGeoLocation(ipAddress)
  if (location === "中国" || location.startsWith("中国 / ") || location === "China" || location.startsWith("China / ")) return location
  return ""
}

export async function resolveStoredGeoLocation(ipAddress: string, geoLocation: string) {
  const trimmed = (geoLocation || "").trim()
  if (trimmed.includes(" / ") || trimmed === "本地/内网") return trimmed
  if (shouldEnrichGeoLocation(trimmed)) return await lookupPublicGeoLocation(ipAddress) || trimmed || "未知"
  return trimmed || "未知"
}

export function getDeviceInfo(headers: Headers) {
  const ua = headers.get("user-agent") ?? ""
  if (!ua) return "未知"

  const browser =
    ua.match(/Edg\/([\d.]+)/) ? "Edge" :
    ua.match(/Chrome\/([\d.]+)/) ? "Chrome" :
    ua.match(/Firefox\/([\d.]+)/) ? "Firefox" :
    ua.match(/Version\/[\d.]+.*Safari/) ? "Safari" :
    ua.match(/MSIE|Trident/) ? "Internet Explorer" :
    "未知浏览器"

  const isIOS = ua.match(/iPhone|iPad|iPod/) || (ua.match(/Mac OS X/) && ua.match(/Mobile\//) && ua.match(/Safari/))
  const os =
    ua.match(/Windows NT/) ? "Windows" :
    ua.match(/Android/) ? "Android" :
    isIOS ? "iOS" :
    ua.match(/Mac OS X/) ? "macOS" :
    ua.match(/Linux/) ? "Linux" :
    "未知系统"

  return `${browser} / ${os}`
}

export async function getRequestMeta(req?: RequestLike): Promise<RequestMeta> {
  if (!req) {
    return { ipAddress: "未知", geoLocation: "未知", deviceInfo: "未知" }
  }

  const ipAddress = getClientIp(req.headers)
  const headerGeoLocation = getGeoLocation(req.headers, ipAddress)
  const enrichedGeoLocation = shouldEnrichGeoLocation(headerGeoLocation)
    ? await lookupPublicGeoLocation(ipAddress)
    : ""

  return {
    ipAddress,
    geoLocation: enrichedGeoLocation || headerGeoLocation || "未知",
    deviceInfo: getDeviceInfo(req.headers),
  }
}

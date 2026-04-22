import "server-only"

export type RequestMeta = {
  ipAddress: string
  geoLocation: string
  deviceInfo: string
}

type RequestLike = {
  headers: Headers
}

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
  return !location || location === "未知" || /^[A-Z]{2}$/i.test(location)
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

async function lookupPublicGeoLocation(ipAddress: string) {
  if (!ipAddress || ipAddress === "未知" || isPrivateOrLocalIp(ipAddress)) return ""

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 900)
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}?lang=zh-CN`, {
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) return ""
    const data = (await response.json()) as {
      success?: boolean
      country?: string
      region?: string
      city?: string
    }
    if (data.success === false) return ""
    return [data.country, data.region, data.city].filter(Boolean).join(" / ")
  } catch {
    return ""
  }
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
    geoLocation: enrichedGeoLocation || headerGeoLocation,
    deviceInfo: getDeviceInfo(req.headers),
  }
}

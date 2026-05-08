export const APP_TIME_ZONE = "Asia/Shanghai"

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  }
}

export function formatDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  const { year, month, day } = partsFor(date)
  return `${year}-${month}-${day}`
}

export function formatChinaDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    ...(options ?? {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }),
  }).format(date)
}

export function formatChinaDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

export function formatChinaTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

const SINGAPORE_TIME_ZONE = "Asia/Singapore"

function singaporePartsFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  // Intl renders midnight as "24" in some browsers — normalize.
  const hour = get("hour") === "24" ? "00" : get("hour")
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  }
}

/** Return current time formatted as `YYYY-MM-DDTHH:mm` in Singapore timezone, suitable for `<input type="datetime-local">`. */
export function nowSingaporeLocalIsoLite(): string {
  const p = singaporePartsFor(new Date())
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** Convert an ISO date string to `YYYY-MM-DDTHH:mm` interpreted in Singapore wall-clock, for `<input type="datetime-local">`. */
export function isoStringToSingaporeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return nowSingaporeLocalIsoLite()
  const p = singaporePartsFor(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** Convert a Singapore wall-clock `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DD`) to an absolute ISO string. */
export function singaporeLocalToIsoString(local: string): string {
  if (!local) return new Date().toISOString()
  const dateOnly = local.length === 10
  const padded = dateOnly ? `${local}T00:00` : local
  // Singapore is fixed UTC+8 with no DST, so a literal +08:00 offset is always correct.
  const withSeconds = padded.length === 16 ? `${padded}:00` : padded
  const iso = `${withSeconds}+08:00`
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

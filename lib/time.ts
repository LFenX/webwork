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

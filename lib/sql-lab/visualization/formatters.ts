export function isNumericValue(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") return Number(value)
  return 0
}

export function isTimeValue(value: unknown) {
  if (value instanceof Date) return true
  if (typeof value === "number") return value > 946684800 && value < 4102444800000
  if (typeof value !== "string") return false
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return !Number.isNaN(Date.parse(value))
  return false
}

export function formatChartLabel(value: unknown) {
  if (value === null || value === undefined) return "空"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

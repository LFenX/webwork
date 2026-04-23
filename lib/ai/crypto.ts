import "server-only"
import crypto from "node:crypto"

function getKeyMaterial() {
  const raw = process.env.AI_SECRET_KEY
  if (!raw) {
    throw new Error("AI_SECRET_KEY env var is required to store AI credentials")
  }
  const maybeBase64 = /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 43
  const buffer = maybeBase64 ? Buffer.from(raw, "base64") : Buffer.from(raw, "utf8")
  return crypto.createHash("sha256").update(buffer).digest()
}

export function maskApiKey(apiKey: string) {
  const value = apiKey.trim()
  if (value.length <= 8) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptSecret(payload: string) {
  const [ivText, tagText, dataText] = payload.split(":")
  if (!ivText || !tagText || !dataText) throw new Error("Invalid encrypted secret payload")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKeyMaterial(), Buffer.from(ivText, "base64"))
  decipher.setAuthTag(Buffer.from(tagText, "base64"))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataText, "base64")), decipher.final()])
  return decrypted.toString("utf8")
}

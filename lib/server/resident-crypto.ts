import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey() {
  const raw = process.env.RESIDENT_DATA_ENCRYPTION_KEY

  if (!raw) {
    throw new Error("Missing RESIDENT_DATA_ENCRYPTION_KEY")
  }

  const key = Buffer.from(raw, "base64")

  if (key.length !== 32) {
    throw new Error("RESIDENT_DATA_ENCRYPTION_KEY must be 32 bytes base64")
  }

  return key
}

export function encryptResidentField(value: string | null | undefined) {
  if (!value) return null

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptResidentField(value: string | null | undefined) {
  if (!value) return null

  const raw = Buffer.from(value, "base64")

  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8")
}

export function normalizeSearchValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

export function containsForbiddenSensitiveText(value: string | null | undefined) {
  const text = normalizeSearchValue(value)

  const blocked = [
    "diagnoze",
    "diagnozes",
    "liga",
    "ligos",
    "teistumas",
    "teistas",
    "religija",
    "politika",
    "partija",
    "profesine sajunga",
    "profsajunga",
    "orientacija",
    "asmens kodas",
    "sveikatos istorija",
  ]

  return blocked.some((word) => text.includes(word))
}
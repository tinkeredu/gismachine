import { MEMORY_SIZE } from './cpudirect/machine'

export { MEMORY_SIZE }

/** Die drei Lernstufen in der Reihenfolge des Unterrichtswegs. */
export const VERSIONS = ['cpudirect', 'altair', 'mnemo'] as const
export type VersionId = (typeof VERSIONS)[number]

export interface VersionInfo {
  id: VersionId
  /** Name in Menüs und Kopfzeile. */
  name: string
  /** Kurzer Untertitel für die Kopfzeile. */
  subtitle: string
  /** Position im Lernweg, z. B. „Stufe 2 von 3“. */
  stage: string
}

export const VERSION_INFO: Record<VersionId, VersionInfo> = {
  cpudirect: { id: 'cpudirect', name: 'CPU-Direkt', subtitle: 'Befehle per Hand, Schritt für Schritt', stage: 'Stufe 1 von 3' },
  altair: { id: 'altair', name: 'Altair', subtitle: 'Programme als 16-Bit-Maschinenwörter', stage: 'Stufe 2 von 3' },
  mnemo: { id: 'mnemo', name: 'MNemo', subtitle: 'Assembler mit 56 Befehlen', stage: 'Stufe 3 von 3' },
}

export function isVersionId(value: unknown): value is VersionId {
  return typeof value === 'string' && (VERSIONS as readonly string[]).includes(value)
}

export function versionIndex(id: VersionId): number {
  return VERSIONS.indexOf(id)
}

/** Richtung eines Wechsels für die Passwort-Dialog-Anzeige. */
export function switchDirection(from: VersionId, to: VersionId): 'forward' | 'backward' | 'same' {
  const a = versionIndex(from)
  const b = versionIndex(to)
  if (a === b) return 'same'
  return b > a ? 'forward' : 'backward'
}

/** Ein Versionswechsel ist nur mit dem gemeinsamen Passwort möglich. */
export function checkPassword(input: string, password: string): boolean {
  return input.trim() === password
}

/* ---------- Gemeinsamer Speicher (256 Wörter à 16 Bit) ---------- */

/** Validiert einen Speicherblock; null, wenn er nicht 256 Werte à 16 Bit ist. */
export function sanitizeMemory(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== MEMORY_SIZE) return null
  if (!value.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)) return null
  return value.map((n) => n & 0xffff)
}

/** Übernimmt das Programm in eine neue Version: nur die 256 Speicherzellen, als Kopie. */
export function transferMemory(memory: readonly number[]): number[] {
  const clean = sanitizeMemory(memory)
  if (!clean) throw new Error('Das Programm muss 256 Werte von 0 bis 65535 enthalten.')
  return clean
}

/* ---------- Programm in der URL (#version oder #version!base64url) ---------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Kodiert 256 Speicherwörter (16 Bit, little-endian) als base64url-String. */
export function encodeProgram(memory: readonly number[]): string {
  const words = transferMemory(memory)
  const bytes = new Uint8Array(MEMORY_SIZE * 2)
  words.forEach((word, i) => {
    bytes[i * 2] = word & 0xff
    bytes[i * 2 + 1] = (word >> 8) & 0xff
  })
  return bytesToBase64Url(bytes)
}

/** Dekodiert einen Programm-String; null bei falscher Länge oder ungültigen Zeichen. */
export function decodeProgram(text: string): number[] | null {
  const bytes = base64UrlToBytes(text)
  if (!bytes || bytes.length !== MEMORY_SIZE * 2) return null
  const words: number[] = []
  for (let i = 0; i < MEMORY_SIZE; i++) words.push(bytes[i * 2] | (bytes[i * 2 + 1] << 8))
  return sanitizeMemory(words)
}

/** Hash für einen Direktlink, z. B. `#mnemo!Ab3…`. Ohne memory nur `#mnemo`. */
export function buildHash(version: VersionId, memory?: readonly number[]): string {
  return memory ? `#${version}!${encodeProgram(memory)}` : `#${version}`
}

export interface ParsedHash {
  version: VersionId | null
  memory: number[] | null
}

/** Liest `#version` oder `#version!programm` aus location.hash. */
export function parseHash(hash: string): ParsedHash {
  const result: ParsedHash = { version: null, memory: null }
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return result
  const bang = raw.indexOf('!')
  const id = bang === -1 ? raw : raw.slice(0, bang)
  if (isVersionId(id)) result.version = id
  if (bang !== -1) result.memory = decodeProgram(raw.slice(bang + 1))
  return result
}

/* ---------- Kleines Storage-Hilfspaket ---------- */

export function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return valid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeText(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Liest den zuletzt gespeicherten Zustand der Suite (Version + Programm). */
export function readSession(): { version: VersionId | null; memory: number[] | null } {
  return {
    version: readStored('gismachine.version', null as VersionId | null, isVersionId),
    memory: readStored('gismachine.memory', null as number[] | null, (v): v is number[] => sanitizeMemory(v) !== null),
  }
}

export function writeSession(version: VersionId, memory: readonly number[]): boolean {
  const okVersion = writeStored('gismachine.version', version)
  const okMemory = writeStored('gismachine.memory', sanitizeMemory(memory) ?? [])
  return okVersion && okMemory
}

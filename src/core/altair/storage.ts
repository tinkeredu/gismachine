import { MEMORY_SIZE, toWord } from './isa'

export function parseNumber(text: string, max = 65535, min = -32768): number | null {
  const s = text.trim()
  if (!/^(?:-?\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/.test(s)) return null
  const value = Number(s)
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

export function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return valid(parsed) ? parsed : fallback
  } catch { return fallback }
}

export function writeStored(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true }
  catch { return false }
}

export function isMemory(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === MEMORY_SIZE && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 65535)
}

export function serializeMemory(memory: readonly number[]): string {
  return JSON.stringify({ format: 'gisaltair', version: 1, memory }, null, 2) + '\n'
}

export function parseMemory(text: string): number[] {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('Ungültige Altair-Datei: keine gültige JSON-Datei.') }
  if (!data || typeof data !== 'object' || !('format' in data) || data.format !== 'gisaltair' || !('version' in data) || data.version !== 1 || !('memory' in data) || !isMemory(data.memory)) {
    throw new Error('Ungültige Altair-Datei: erwartet werden Format gisaltair, Version 1 und 256 Zahlen von 0 bis 65535.')
  }
  return data.memory.map(toWord)
}

export function serializePc1(memory: readonly number[]): ArrayBuffer {
  if (!isMemory(memory)) throw new Error('Der Speicher muss 256 gültige 16-Bit-Wörter enthalten.')
  const buffer = new ArrayBuffer(512)
  const view = new DataView(buffer)
  memory.forEach((word, index) => view.setUint16(index * 2, word, true))
  return buffer
}

export function parsePc1(buffer: ArrayBuffer): number[] {
  if (buffer.byteLength !== 512) throw new Error('Eine PC1-Datei muss genau 512 Byte (256 Speicherwörter) enthalten.')
  const view = new DataView(buffer)
  return Array.from({ length: MEMORY_SIZE }, (_, index) => view.getUint16(index * 2, true))
}

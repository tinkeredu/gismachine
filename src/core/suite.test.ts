import { describe, expect, it } from 'vitest'
import {
  MEMORY_SIZE,
  buildHash,
  checkPassword,
  decodeProgram,
  encodeProgram,
  isVersionId,
  parseHash,
  sanitizeMemory,
  switchDirection,
  transferMemory,
  VERSIONS,
  versionIndex,
} from './suite'

const sample = Array.from({ length: MEMORY_SIZE }, (_, i) => (i * 257) & 0xffff)

describe('Versionswechsel', () => {
  it('kennt die drei Stufen in der Reihenfolge des Lernwegs', () => {
    expect(VERSIONS).toEqual(['cpudirect', 'altair', 'mnemo'])
    expect(versionIndex('cpudirect')).toBe(0)
    expect(versionIndex('mnemo')).toBe(2)
    expect(isVersionId('altair')).toBe(true)
    expect(isVersionId('cpud')).toBe(false)
    expect(isVersionId(42)).toBe(false)
  })

  it('erkennt Vorwärts-, Rückwärts- und Selbstwechsel', () => {
    expect(switchDirection('cpudirect', 'altair')).toBe('forward')
    expect(switchDirection('cpudirect', 'mnemo')).toBe('forward')
    expect(switchDirection('mnemo', 'cpudirect')).toBe('backward')
    expect(switchDirection('altair', 'altair')).toBe('same')
  })

  it('prüft das Passwort exakt (nach Trimmen)', () => {
    expect(checkPassword('schule', 'schule')).toBe(true)
    expect(checkPassword('  schule  ', 'schule')).toBe(true)
    expect(checkPassword('Schule', 'schule')).toBe(false)
    expect(checkPassword('', 'schule')).toBe(false)
    expect(checkPassword('schule', '')).toBe(false)
  })
})

describe('Programm-Transfer zwischen den Versionen', () => {
  it('übernimmt genau die 256 Speicherzellen als Kopie', () => {
    const transferred = transferMemory(sample)
    expect(transferred).toHaveLength(MEMORY_SIZE)
    expect(transferred).toEqual(sample)
    expect(transferred).not.toBe(sample)
  })

  it('lehnt unvollständige oder ungültige Speicher ab', () => {
    expect(sanitizeMemory([1, 2, 3])).toBeNull()
    expect(sanitizeMemory(new Array(256).fill(-1))).toBeNull()
    expect(sanitizeMemory(new Array(256).fill(65536))).toBeNull()
    expect(sanitizeMemory(new Array(256).fill(1.5))).toBeNull()
    expect(sanitizeMemory('kein speicher')).toBeNull()
    expect(sanitizeMemory(null)).toBeNull()
    expect(sanitizeMemory(new Array(256).fill(7))).toEqual(new Array(256).fill(7))
  })

  it('lehnt Werte außerhalb von 16 Bit ab', () => {
    expect(sanitizeMemory(new Array(256).fill(0x1ffff))).toBeNull()
    expect(sanitizeMemory(new Array(256).fill(-1))).toBeNull()
  })
})

describe('Direktlinks', () => {
  it('kodiert und dekodiert ein Programm verlustfrei', () => {
    const encoded = encodeProgram(sample)
    expect(decodeProgram(encoded)).toEqual(sample)
  })

  it('buildHash und parseHash bilden einen Hash mit Programm', () => {
    const hash = buildHash('mnemo', sample)
    expect(hash.startsWith('#mnemo!')).toBe(true)
    const parsed = parseHash(hash)
    expect(parsed.version).toBe('mnemo')
    expect(parsed.memory).toEqual(sample)
  })

  it('parseHash versteht auch einen reinen Versionslink', () => {
    expect(parseHash('#altair')).toEqual({ version: 'altair', memory: null })
    expect(parseHash('#cpudirect')).toEqual({ version: 'cpudirect', memory: null })
  })

  it('verkraftet kaputte Hashes', () => {
    expect(parseHash('')).toEqual({ version: null, memory: null })
    expect(parseHash('#')).toEqual({ version: null, memory: null })
    expect(parseHash('#unbekannt')).toEqual({ version: null, memory: null })
    expect(parseHash('#mnemo!kaputt')).toEqual({ version: 'mnemo', memory: null })
    expect(parseHash('#mnemo!')).toEqual({ version: 'mnemo', memory: null })
    expect(decodeProgram('!!!')).toBeNull()
    expect(decodeProgram('')).toBeNull()
  })

  it('erzeugt nur URL-sichere Zeichen', () => {
    for (const word of [0, 1, 255, 256, 32768, 65535, 0x1234, 0xabcd]) {
      const memory = new Array(MEMORY_SIZE).fill(word)
      expect(encodeProgram(memory)).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(decodeProgram(encodeProgram(memory))).toEqual(memory)
    }
  })
})

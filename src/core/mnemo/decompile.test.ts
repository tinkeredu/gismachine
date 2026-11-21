import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../altair/examples'
import { encode as altairEncode } from '../altair/isa'
import { assemble } from './assembler'
import { decompile } from './decompile'

const blank = () => new Array<number>(256).fill(0)
const roundtrip = (memory: number[]) => {
  const source = decompile(memory)
  expect(source).not.toBeNull()
  const result = assemble(source!)
  expect(result.errors).toEqual([])
  expect(result.memory).toEqual(memory)
  return source!
}

describe('decompile', () => {
  it('liefert null für leeren Speicher', () => {
    expect(decompile(blank())).toBeNull()
  })

  it('übersetzt das Altair-Beispiel (OUTM 8, STOP, Daten in Zelle 8) exakt zurück', () => {
    const source = roundtrip(EXAMPLES[0].memory)
    expect(source).toContain('OUTM ausgabe')
    expect(source).toContain('STOP')
    expect(source).toContain('ausgabe\tDEF 13')
  })

  it('übersetzt alle Altair-Beispiele, deren Daten hinter dem Code liegen', () => {
    for (const example of EXAMPLES) {
      expect(roundtrip(example.memory)).not.toContain('Keine passende Befehlsfolge')
    }
  })

  it('erzeugt Sprungmarken und Variablen jenseits der letzten belegten Zelle', () => {
    const mem = blank()
    mem[0] = altairEncode(25, 20) // INM 20
    mem[1] = altairEncode(1, 20) // LDA 20
    mem[2] = altairEncode(33, 4) // JZE 4
    mem[3] = altairEncode(30, 0) // JMP 0
    mem[4] = altairEncode(39) // STOP
    const source = roundtrip(mem)
    expect(source).toMatch(/^schleife$/m)
    expect(source).toMatch(/^programmende$/m)
    expect(source).toContain('eingabe\tDEF 0')
  })

  it('übersetzt reine Daten (z. B. aus CPU-Direkt) als Variablen', () => {
    const mem = blank()
    mem[8] = 5
    mem[9] = 3
    mem[10] = 0xfff8
    const source = roundtrip(mem)
    expect(source).toContain('daten010\tDEF -8')
  })

  it('weicht auf reine Datenzellen aus, wenn der Code nicht darstellbar ist', () => {
    const mem = blank()
    mem[0] = altairEncode(1, 0) // LDA 0 – Variable im Codebereich
    mem[1] = altairEncode(39)
    const source = roundtrip(mem)
    expect(source).toContain('Keine passende Befehlsfolge')
    expect(source).toContain('daten000\tDEF 256')
  })

  it('benennt mehrere Eingaben eindeutig und trennt sie vom Ergebnis', () => {
    const source = roundtrip(EXAMPLES[1].memory)
    expect(source).toContain('INM eingabe008')
    expect(source).toContain('INM eingabe009')
    expect(source).toContain('STA ergebnis')
    expect(source).toContain('OUTM ergebnis')
  })
})

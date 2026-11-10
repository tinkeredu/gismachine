import { describe, expect, it } from 'vitest'
import { DIV_ZERO, formatBinary, formatOutput, initialMachine, memoryLine, protocolLine, reduce, run, toSigned, type Machine } from './machine'

const ops = (...steps: [Parameters<typeof run>[1], number?, number?][]) =>
  steps.reduce<Machine>((m, [op, addr, input]) => run(m, op, addr, input), initialMachine())

describe('Rechenwerk (am Original unter Wine nachgemessen)', () => {
  it('DEC von 0 ergibt -1, Speicher zeigt alle Bits gesetzt', () => {
    const m = ops(['DEC'], ['STA', 0])
    expect(toSigned(m.ac)).toBe(-1)
    expect(memoryLine(0, m.mem[0])).toBe('  0: 1111 1111  1111 1111')
  })

  it('ADD läuft bei 16 Bit über', () => {
    const m = ops(['INM', 1, 16387], ['LDA', 1], ['ADD', 1])
    expect(toSigned(m.ac)).toBe(-32762)
  })

  it('DIV rechnet vorzeichenlos (32774 / 16387 = 2, -6 / 2 = 32765)', () => {
    let m = ops(['INM', 1, 16387], ['LDA', 1], ['ADD', 1], ['DIV', 1])
    expect(m.ac).toBe(2)
    m = ops(['INC'], ['INC'], ['STA', 0], ...Array.from({ length: 8 }, () => ['DEC'] as ['DEC']), ['DIV', 0])
    expect(m.ac).toBe(32765)
  })

  it('MUL behält die unteren 16 Bit', () => {
    const m = ops(['INM', 1, 16387], ['INM', 2, 32765], ['LDA', 2], ['MUL', 1])
    expect(toSigned(m.ac)).toBe(-16393)
  })

  it('NEG invertiert alle Bits, SHL/SHR schieben logisch', () => {
    let m = ops(['INC'], ['INC'], ['NEG'])
    expect(formatBinary(m.ac)).toBe('1111 1111  1111 1101')
    m = run(m, 'SHL')
    expect(formatBinary(m.ac)).toBe('1111 1111  1111 1010')
    m = run(m, 'SHR')
    expect(formatBinary(m.ac)).toBe('0111 1111  1111 1101')
  })

  it('AND, OR, XOR', () => {
    const base = ops(['INM', 0, 0b1100], ['INM', 1, 0b1010], ['LDA', 0])
    expect(run(base, 'AND', 1).ac).toBe(0b1000)
    expect(run(base, 'OR', 1).ac).toBe(0b1110)
    expect(run(base, 'XOR', 1).ac).toBe(0b0110)
  })
})

describe('Bedienung', () => {
  it('Division durch 0 meldet einen Fehler und wartet weiter auf eine Zelle', () => {
    let m = ops(['INC'])
    m = reduce(reduce(m, { type: 'op', op: 'DIV' }), { type: 'cell', addr: 5 })
    expect(m.alert).toBe(DIV_ZERO)
    expect(m.pending?.op).toBe('DIV')
    m = reduce(m, { type: 'dismissAlert' })
    m = reduce(m, { type: 'cell', addr: 5 })
    expect(m.alert).toBe(DIV_ZERO)
  })

  it('INM: erst Zelle, dann Daten übernehmen; Eingabe wird danach gelöscht', () => {
    let m = reduce(initialMachine(), { type: 'op', op: 'INM' })
    expect(m.status).toBe('INM: Bitte die Ziel-Speicherzelle anklicken oder mit [ESC] abbrechen')
    m = reduce(m, { type: 'cell', addr: 1 })
    expect(m.status).toBe('Bitte die zu speichernden Daten eingeben oder mit [ESC] abbrechen')
    m = reduce(reduce(reduce(m, { type: 'toggleBit', bit: 0 }), { type: 'toggleBit', bit: 14 }), { type: 'toggleBit', bit: 1 })
    m = reduce(m, { type: 'commit' })
    expect(m.mem[1]).toBe(16387)
    expect(m.input).toBe(0)
    expect(m.protocol).toEqual(['INM    1; Zahl einlesen und in Zelle 1 speichern'])
  })

  it('ESC bricht Adressauswahl und Dateneingabe ab', () => {
    let m = reduce(reduce(initialMachine(), { type: 'op', op: 'LDA' }), { type: 'cancel' })
    expect(m.status).toBe('Auswahl der Adresse wurde abgebrochen!')
    expect(m.pending).toBeNull()
    m = reduce(reduce(reduce(m, { type: 'op', op: 'INM' }), { type: 'cell', addr: 3 }), { type: 'cancel' })
    expect(m.status).toBe('Dateneingabe wurde abgebrochen!')
    expect(m.mem[3]).toBe(0)
  })

  it('während einer Auswahl sind andere Befehle gesperrt', () => {
    const m = reduce(reduce(initialMachine(), { type: 'op', op: 'LDA' }), { type: 'op', op: 'INC' })
    expect(m.ac).toBe(0)
    expect(m.pending?.op).toBe('LDA')
  })

  it('Protokoll nur bei laufender Aufzeichnung, optional ohne Kommentar', () => {
    let m = reduce(initialMachine(), { type: 'comment', on: false })
    m = run(m, 'INC')
    m = run(m, 'STA', 10)
    m = reduce(m, { type: 'record', on: false })
    m = run(m, 'DEC')
    expect(m.protocol).toEqual(['INC', 'STA   10'])
  })

  it('Ausgabe dezimal wie im Original', () => {
    expect(formatOutput(65535)).toBe('65535  (-1)')
    expect(formatOutput(42)).toBe('42')
    expect(protocolLine('DEC', null, true)).toBe('DEC     ; AC um 1 vermindern')
    expect(ops(['DEC'], ['STA', 0], ['OUTM', 0]).output).toBe(65535)
  })
})

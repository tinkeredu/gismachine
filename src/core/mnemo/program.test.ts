import { describe, expect, it } from 'vitest'
import { assemble } from './assembler'
import { openMnemoProgram } from './program'

const document = {
  source: '; Zahl um eins erhöhen\nINM a\nLDA a\nINC\nSTA a\nOUTM a\nSTOP\na DEF 1\n',
  fileName: 'zaehlen.mno',
}
const compiled = assemble(document.source)

describe('MNemo-Programm öffnen', () => {
  it('behält beim Fortsetzen originale Namen, Kommentare und DEF-Anfangswerte nach dem Lauf', () => {
    const memory = compiled.memory.slice()
    memory[6] = 5
    const program = openMnemoProgram(memory, 'resume', document)
    expect(program).toMatchObject({ ...document, generated: false, lineOfAddress: compiled.lineOfAddress })
  })

  it('behält auch unübersetzte Entwürfe beim Fortsetzen', () => {
    const draft = { ...document, source: 'INM ' }
    expect(openMnemoProgram(compiled.memory, 'resume', draft)).toMatchObject({ ...draft, lineOfAddress: [] })
  })

  it('nutzt im Direktlink den enthaltenen Quelltext statt des lokalen Entwurfs', () => {
    const draft = { source: 'STOP', fileName: 'entwurf.mno' }
    expect(openMnemoProgram(compiled.memory, 'import', draft, document)).toMatchObject({ ...document, generated: false })
  })

  it('startet ohne Übernahme mit leerem Editor statt des letzten Quelltexts', () => {
    expect(openMnemoProgram(new Array(256).fill(0), 'empty', document)).toMatchObject({ source: '', generated: false })
  })

  it('übersetzt Speicher ohne Quelltext mit sprechenden Namen', () => {
    const imported = openMnemoProgram(compiled.memory, 'import', null)
    expect(imported.generated).toBe(true)
    expect(imported.source).toBe('\tINM eingabe\n\tLDA eingabe\n\tINC\n\tSTA eingabe\n\tOUTM eingabe\n\tSTOP\n\neingabe\tDEF 1\n')
    expect(assemble(imported.source).memory).toEqual(compiled.memory)
  })
})

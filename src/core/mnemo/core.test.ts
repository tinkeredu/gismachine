import { describe, expect, it } from 'vitest'
import { assemble, formatDiagnostics } from './assembler'
import { Cpu } from './cpu'
import { formatInstruction, formatMemoryCell, formatValue } from './format'
import { encode } from './isa'

function run(source: string, inputs: number[] = [], maxSteps = 100000) {
  const res = assemble(source)
  expect(res.errors).toEqual([])
  const cpu = new Cpu(res.memory)
  let steps = 0
  while (cpu.state !== 'halted' && cpu.state !== 'error' && steps++ < maxSteps) {
    if (cpu.state === 'input') cpu.provideInput(inputs.shift()!)
    else cpu.step()
  }
  return cpu
}

describe('assembler', () => {
  it('lays out code first, DEF cells afterwards (like the original)', () => {
    const r = assemble('inm zahl1\ninm zahl2\nlda zahl1\nadd zahl2\nsta summe\noutm summe\nstop\nzahl1 def 0\nzahl2 def 7\nsumme def -3\n')
    expect(r.ok).toBe(true)
    expect(r.memory.slice(0, 10)).toEqual([
      encode(25, 7), encode(25, 8), encode(1, 7), encode(9, 8), encode(2, 9), encode(24, 9), encode(39, 0), 0, 7, 0xfffd,
    ])
    expect(formatMemoryCell(0, r.memory[0])).toBe('000: inm    7')
    expect(formatMemoryCell(8, r.memory[8])).toBe('008:       7')
    expect(formatMemoryCell(9, r.memory[9])).toBe('009: ?    253')
  })

  it('treats a lone identifier as jump label for the next instruction', () => {
    const r = assemble('inm zaehler\nanfang\noutm zaehler\nlda zaehler\ndec\nsta zaehler\njpl anfang\nstop\nzaehler def 0')
    expect(r.ok).toBe(true)
    expect(r.labels.get('anfang')).toBe(1)
    expect(r.memory[5]).toBe(encode(32, 1))
  })

  it('reports errors with the original codes (definition errors first)', () => {
    const src = ['nop', 'lda x', 'foo', 'lda', 'add 5', 'jmp nirgends', 'sta a b', 'a def', 'b def xyz', 'a def 3', 'k equal', 'lda a ; ok', 'lda a kommentar', 'unter spbp', 'ldas k2', 'stop'].join('\n')
    const r = assemble(src)
    expect(r.errors.map((e) => [e.line, e.code])).toEqual([
      [7, 8], [8, 7], [10, 10],
      [1, 13], [3, 18], [4, 13], [5, 14], [6, 16], [12, 16], [13, 15], [14, 12],
    ])
    expect(formatDiagnostics(r)).toContain('******Fehler******\nZeile: 7   8  fehlender Variablenwert')
    expect(r.hints.map((h) => [h.line, h.code])).toContainEqual([0, 3])
  })

  it('reports empty source', () => {
    expect(assemble('  ; nur Kommentar\n').errors[0].code).toBe(1)
  })
})

describe('cpu', () => {
  it('adds two input numbers', () => {
    const cpu = run('inm a\ninm b\nlda a\nadd b\nsta s\noutm s\nstop\na def 0\nb def 0\ns def 0', [3, 4])
    expect(cpu.output).toEqual([7])
    expect(cpu.pc).toBe(6)
  })

  it('wraps at 16 bit and shifts logically', () => {
    const cpu = run('lda a\nadd b\nsta c\noutm c\nlda m\nshr\nsta c\noutm c\nlda m\ninc\nsta c\noutm c\nstop\na def 32767\nb def 1\nc def 0\nm def -1')
    expect(cpu.output).toEqual([32768, 32767, 0])
    expect(formatValue(32768)).toBe('32768 (-32768)')
  })

  it('stack, subroutine, SP/BP-relative access', () => {
    const cpu = run('off equal 2\npsh\nlda a\npsh\njsr unter\noutm a\npop\nsta a\noutm a\nstop\nunter\nspbp\nldas off\ninc\nstas off\nldab off\nsta a\nrtn\na def 5')
    expect(cpu.output).toEqual([6, 6])
    expect(cpu.sp).toBe(254)
    expect(cpu.bp).toBe(252)
    expect(cpu.mem[253]).toBe(4)
  })

  it('stops with an error on division by zero', () => {
    const res = assemble('lda a\ndiv z\nstop\na def 4\nz def 0')
    const cpu = new Cpu(res.memory)
    cpu.step()
    cpu.step()
    expect(cpu.state).toBe('error')
    expect(cpu.error).toBe('Division durch Null.')
  })

  it('runs fetch/decode/execute as separate phases', () => {
    const cpu = new Cpu(assemble('lda a\nstop\na def 9').memory)
    cpu.microStep()
    expect(cpu.phase).toBe('decode')
    expect(formatInstruction(cpu.ir)).toBe('lda   2')
    expect(cpu.pc).toBe(1)
    cpu.microStep()
    cpu.microStep()
    expect(cpu.ac).toBe(9)
    expect(cpu.phase).toBe('fetch')
  })

  it('runs the square-number and Euclid GCD programs', () => {
    const squares = `inm n
anfang
lda q
add u
sta q
outm q
lda u
add zwei
sta u
lda n
dec
sta n
jpl anfang
stop
n def 0
q def 0
u def 1
zwei def 2`
    expect(run(squares, [5]).output).toEqual([1, 4, 9, 16, 25])

    const ggt = `inm a
inm b
schleife
lda a
sub b
jze fertig
jms bgroesser
sta a
jmp schleife
bgroesser
lda b
sub a
sta b
jmp schleife
fertig
outm a
stop
a def 0
b def 0`
    expect(run(ggt, [44, 12]).output).toEqual([4])
  })
})

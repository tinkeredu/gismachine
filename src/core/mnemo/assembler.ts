import { MEMORY_SIZE, OP_BY_NAME, encode, toWord, type OpInfo } from './isa'

export const ERROR_TEXTS: Record<number, string> = {
  1: 'kein Quelltext eingegeben',
  2: 'Konstante doppelt definiert',
  3: 'Variable doppelt definiert',
  4: 'ungültiger Variablenname',
  5: 'ungültiger Konstantenname',
  6: 'ungültiger Sprungadressenname',
  7: 'falscher Variablenwert',
  8: 'fehlender Variablenwert',
  9: 'falscher Konstantenwert',
  10: 'fehlender Konstantenwert',
  11: 'Sprungadresse doppelt definiert',
  12: 'Unbekannte Konstante',
  13: 'Unbekannte Variable',
  14: 'Unbekannte Sprungadresse',
  15: 'Kommentar ohne ";" oder Tippfehler',
  16: 'zu viele Parameter',
  17: 'fehlender Parameter (Konstante oder Zahl)',
  18: 'fehlender Parameter (Variable)',
  19: 'fehlender Parameter (Sprungziel)',
  20: 'fehlender Variablenname',
  21: 'fehlender Konstantenname',
  22: 'fehlender Befehl',
  23: 'fehlende Adresse',
  24: 'Programm zu groß (mehr als 256 Speicherzellen)',
}

export const HINT_TEXTS: Record<number, string> = {
  1: 'Variable definiert aber nicht genutzt',
  2: 'Konstante definiert aber nicht genutzt',
  3: 'Sprungziel definiert aber nicht genutzt',
  4: 'Wert in Akkumulator geladen aber nicht genutzt',
}

export interface Diagnostic {
  /** 0-based source line, as in the original editor. */
  line: number
  code: number
  message: string
}

export interface AssembleResult {
  ok: boolean
  memory: number[]
  errors: Diagnostic[]
  hints: Diagnostic[]
  /** address -> 0-based source line (instructions and DEF cells). */
  lineOfAddress: (number | null)[]
  variables: Map<string, number>
  labels: Map<string, number>
  constants: Map<string, number>
  codeSize: number
}

const KEYWORDS = new Set(['def', 'equal'])
const NUMBER_RE = /^[+-]?\d+$/
const NAME_RE = /^[a-z0-9_äöüß]+$/

const isValidName = (name: string) =>
  NAME_RE.test(name) && !NUMBER_RE.test(name) && !OP_BY_NAME.has(name) && !KEYWORDS.has(name)

interface Instr {
  line: number
  op: OpInfo
  args: string[]
  address: number
}

interface Def {
  line: number
  name: string
  value: number
}

const diag = (line: number, code: number, texts: Record<number, string>): Diagnostic => ({
  line,
  code,
  message: texts[code],
})

export function tokenize(line: string): string[] {
  const semi = line.indexOf(';')
  const code = semi >= 0 ? line.slice(0, semi) : line
  return code.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function assemble(source: string): AssembleResult {
  const lines = source.split(/\r\n|\r|\n/)
  const defErrors: Diagnostic[] = []
  const codeErrors: Diagnostic[] = []
  const hints: Diagnostic[] = []

  const instrs: Instr[] = []
  const vars: Def[] = []
  const variables = new Map<string, number>()
  const constants = new Map<string, number>()
  const constLines = new Map<string, number>()
  const labels = new Map<string, number>()
  const labelLines = new Map<string, number>()
  const labelTargets = new Set<number>()
  let hasContent = false

  lines.forEach((raw, line) => {
    const t = tokenize(raw)
    if (t.length === 0) return
    hasContent = true

    if (t[0] === 'def') return void defErrors.push(diag(line, 20, ERROR_TEXTS))
    if (t[0] === 'equal') return void defErrors.push(diag(line, 21, ERROR_TEXTS))

    if (t[1] === 'def') {
      const [name, , value] = t
      if (!isValidName(name)) return void defErrors.push(diag(line, 4, ERROR_TEXTS))
      if (value === undefined) return void defErrors.push(diag(line, 8, ERROR_TEXTS))
      if (!NUMBER_RE.test(value)) return void defErrors.push(diag(line, 7, ERROR_TEXTS))
      if (t.length > 3) return void defErrors.push(diag(line, 16, ERROR_TEXTS))
      if (variables.has(name)) return void defErrors.push(diag(line, 3, ERROR_TEXTS))
      variables.set(name, -1)
      vars.push({ line, name, value: toWord(parseInt(value, 10)) })
      return
    }

    if (t[1] === 'equal') {
      const [name, , value] = t
      if (!isValidName(name)) return void defErrors.push(diag(line, 5, ERROR_TEXTS))
      if (value === undefined) return void defErrors.push(diag(line, 10, ERROR_TEXTS))
      if (!NUMBER_RE.test(value)) return void defErrors.push(diag(line, 9, ERROR_TEXTS))
      if (t.length > 3) return void defErrors.push(diag(line, 16, ERROR_TEXTS))
      if (constants.has(name)) return void defErrors.push(diag(line, 2, ERROR_TEXTS))
      constants.set(name, parseInt(value, 10))
      constLines.set(name, line)
      return
    }

    const op = OP_BY_NAME.get(t[0])
    if (op) {
      instrs.push({ line, op, args: t.slice(1), address: instrs.length })
      return
    }

    if (t.length === 1) {
      const name = t[0]
      if (!isValidName(name)) return void codeErrors.push(diag(line, 6, ERROR_TEXTS))
      if (labels.has(name)) return void codeErrors.push(diag(line, 11, ERROR_TEXTS))
      labels.set(name, instrs.length)
      labelLines.set(name, line)
      labelTargets.add(instrs.length)
      return
    }

    codeErrors.push(diag(line, 15, ERROR_TEXTS))
  })

  if (!hasContent) defErrors.push(diag(0, 1, ERROR_TEXTS))

  const codeSize = instrs.length
  vars.forEach((v, i) => variables.set(v.name, codeSize + i))
  if (codeSize + vars.length > MEMORY_SIZE) {
    codeErrors.push(diag(vars[Math.max(0, MEMORY_SIZE - codeSize)]?.line ?? instrs[MEMORY_SIZE]?.line ?? 0, 24, ERROR_TEXTS))
  }

  const usedVars = new Set<string>()
  const usedConsts = new Set<string>()
  const usedLabels = new Set<string>()
  const memory = new Array<number>(MEMORY_SIZE).fill(0)
  const lineOfAddress = new Array<number | null>(MEMORY_SIZE).fill(null)

  for (const ins of instrs) {
    const { op, args, line } = ins
    let operand = 0
    if (op.operand === 'none') {
      if (args.length > 0) codeErrors.push(diag(line, 16, ERROR_TEXTS))
    } else if (args.length === 0) {
      codeErrors.push(diag(line, op.operand === 'var' ? 18 : op.operand === 'label' ? 19 : 17, ERROR_TEXTS))
    } else if (args.length > 1) {
      codeErrors.push(diag(line, 16, ERROR_TEXTS))
    } else {
      const arg = args[0]
      if (op.operand === 'var') {
        const addr = variables.get(arg)
        if (addr === undefined) codeErrors.push(diag(line, 13, ERROR_TEXTS))
        else {
          operand = addr
          usedVars.add(arg)
        }
      } else if (op.operand === 'label') {
        const addr = labels.get(arg)
        if (addr === undefined) codeErrors.push(diag(line, 14, ERROR_TEXTS))
        else {
          operand = addr
          usedLabels.add(arg)
        }
      } else if (NUMBER_RE.test(arg)) {
        operand = parseInt(arg, 10)
      } else {
        const value = constants.get(arg)
        if (value === undefined) codeErrors.push(diag(line, 12, ERROR_TEXTS))
        else {
          operand = value
          usedConsts.add(arg)
        }
      }
    }
    if (ins.address < MEMORY_SIZE) {
      memory[ins.address] = encode(op.code, operand)
      lineOfAddress[ins.address] = line
    }
  }

  vars.forEach((v) => {
    const addr = variables.get(v.name)!
    if (addr < MEMORY_SIZE) {
      memory[addr] = v.value
      lineOfAddress[addr] = v.line
    }
  })

  for (const v of vars) if (!usedVars.has(v.name)) hints.push(diag(v.line, 1, HINT_TEXTS))
  for (const [name, line] of constLines) if (!usedConsts.has(name)) hints.push(diag(line, 2, HINT_TEXTS))
  for (const [name, line] of labelLines) if (!usedLabels.has(name)) hints.push(diag(line, 3, HINT_TEXTS))

  const overwritesAc = new Set(['lda', 'ldas', 'ldab', 'pop', 'stop'])
  instrs.forEach((ins, i) => {
    const next = instrs[i + 1]
    if (ins.op.name === 'lda' && next && overwritesAc.has(next.op.name) && !labelTargets.has(next.address)) {
      hints.push(diag(ins.line, 4, HINT_TEXTS))
    }
  })

  const byLine = (a: Diagnostic, b: Diagnostic) => a.line - b.line
  const errors = [...defErrors.sort(byLine), ...codeErrors.sort(byLine)]
  hints.sort(byLine)

  return {
    ok: errors.length === 0,
    memory,
    errors,
    hints,
    lineOfAddress,
    variables,
    labels,
    constants,
    codeSize,
  }
}

export function formatDiagnostics(result: Pick<AssembleResult, 'errors' | 'hints'>): string {
  const out: string[] = []
  const row = (d: Diagnostic) => `Zeile: ${d.line}   ${d.code}  ${d.message}`
  if (result.errors.length) out.push('******Fehler******', ...result.errors.map(row))
  if (result.hints.length) out.push('******Hinweise******', ...result.hints.map(row))
  return out.join('\n')
}

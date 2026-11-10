export type Op = 'LDA' | 'STA' | 'INM' | 'OUTM' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'AND' | 'OR' | 'XOR' | 'INC' | 'DEC' | 'SHL' | 'SHR' | 'NEG'

/** Befehle, nach denen eine Speicherzelle angeklickt werden muss. */
export const MEMORY_OPS: readonly Op[] = ['LDA', 'STA', 'INM', 'OUTM', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'OR', 'XOR']

/** Kurzbeschreibung wie im Tooltip des Originals; X steht für die gewählte Adresse. */
export const HINTS: Record<Op, string> = {
  LDA: 'Zelle X in den AC kopieren',
  STA: 'den AC nach Zelle X kopieren',
  INM: 'Zahl einlesen und in Zelle X speichern',
  OUTM: 'Zelle X in die Ausgabe kopieren',
  ADD: 'Zelle X zum AC addieren. Ergebnis im AC',
  SUB: 'Zelle X vom AC subtrahieren. Ergebnis im AC',
  MUL: 'Den AC mit Zelle X multiplizieren. Ergebnis im AC',
  DIV: 'Den AC durch Zelle X dividieren. Ergebnis im AC',
  AND: 'bitweise UND-Verknüpfung zwischen AC und Zelle X',
  OR: 'bitweise ODER-Verknüpfung zwischen AC und Zelle X',
  XOR: 'bitweise EXKLUSIV-ODER-Verknüpfung zwischen AC und Zelle X',
  INC: 'AC um 1 erhöhen',
  DEC: 'AC um 1 vermindern',
  SHL: 'verschiebe die Bits im AC um eine Stelle nach links',
  SHR: 'verschiebe die Bits im AC um eine Stelle nach rechts',
  NEG: 'negiere den AC (aus 0 wird 1 und umgekehrt)',
}

export const MEMORY_SIZE = 256
export const READY = 'Bitte einen Maschinenbefehl auswählen'
export const DIV_ZERO = 'Der Wert in der ausgewählten Zelle ist 0.\n\nDivision durch 0 ist nicht erlaubt!'
export const DATA_PROMPT = 'Bitte die zu speichernden Daten eingeben oder mit [ESC] abbrechen'

export type Pending = { op: Op; stage: 'address' } | { op: 'INM'; stage: 'data'; addr: number }

export interface Machine {
  /** 16-Bit-Wort, intern vorzeichenlos 0 … 65535. */
  ac: number
  mem: number[]
  output: number
  input: number
  pending: Pending | null
  status: string
  statusIsError: boolean
  protocol: string[]
  recording: boolean
  withComment: boolean
  /** zuletzt benutzte Speicherzelle */
  last: number | null
  alert: string | null
}

export type Action =
  | { type: 'op'; op: Op }
  | { type: 'cell'; addr: number }
  | { type: 'commit' }
  | { type: 'cancel' }
  | { type: 'toggleBit'; bit: number }
  | { type: 'setInput'; value: number }
  | { type: 'clearMemory' }
  | { type: 'record'; on: boolean }
  | { type: 'comment'; on: boolean }
  | { type: 'clearProtocol' }
  | { type: 'dismissAlert' }

export function initialMachine(): Machine {
  return {
    ac: 0,
    mem: new Array(MEMORY_SIZE).fill(0),
    output: 0,
    input: 0,
    pending: null,
    status: READY,
    statusIsError: false,
    protocol: [],
    recording: true,
    withComment: true,
    last: null,
    alert: null,
  }
}

const word = (n: number) => ((n % 0x10000) + 0x10000) % 0x10000

export function toSigned(w: number) {
  return w >= 0x8000 ? w - 0x10000 : w
}

/** Befehle, die nur den AC verändern. */
export function execAc(op: Op, ac: number): number {
  switch (op) {
    case 'INC':
      return word(ac + 1)
    case 'DEC':
      return word(ac - 1)
    case 'SHL':
      return word(ac << 1)
    case 'SHR':
      return ac >>> 1
    case 'NEG':
      return ~ac & 0xffff
    default:
      throw new Error(`${op} braucht eine Speicherzelle`)
  }
}

/** Verknüpft AC und Zelle. MUL/DIV rechnen wie das Original mit vorzeichenlosen 16-Bit-Werten. */
export function execAlu(op: Op, ac: number, cell: number): number | null {
  switch (op) {
    case 'ADD':
      return word(ac + cell)
    case 'SUB':
      return word(ac - cell)
    case 'MUL':
      return Number((BigInt(ac) * BigInt(cell)) % 0x10000n)
    case 'DIV':
      return cell === 0 ? null : Math.floor(ac / cell)
    case 'AND':
      return ac & cell
    case 'OR':
      return ac | cell
    case 'XOR':
      return ac ^ cell
    default:
      throw new Error(`${op} ist keine Rechenoperation`)
  }
}

export function protocolLine(op: Op, addr: number | null, withComment: boolean) {
  const cmd = `${op.padEnd(4)} ${addr === null ? '   ' : String(addr).padStart(3)}`
  if (!withComment) return cmd.trimEnd()
  return `${cmd}; ${HINTS[op].replace('X', addr === null ? 'X' : String(addr))}`
}

export function formatBinary(w: number) {
  const s = w.toString(2).padStart(16, '0')
  return `${s.slice(0, 4)} ${s.slice(4, 8)}  ${s.slice(8, 12)} ${s.slice(12)}`
}

/** Dezimalanzeige der Ausgabe wie im Original: „65535  (-1)“. */
export function formatOutput(w: number) {
  return w >= 0x8000 ? `${w}  (${toSigned(w)})` : String(w)
}

export function memoryLine(addr: number, w: number) {
  return `${String(addr).padStart(3)}: ${formatBinary(w)}`
}

export function promptFor(op: Op) {
  switch (op) {
    case 'STA':
    case 'INM':
      return `${op}: Bitte die Ziel-Speicherzelle anklicken oder mit [ESC] abbrechen`
    case 'LDA':
    case 'OUTM':
      return `${op}: Bitte die Quell-Speicherzelle anklicken oder mit [ESC] abbrechen`
    default:
      return `${op}: Bitte die Speicherzelle mit dem zweiten Operanden anklicken oder mit [ESC] abbrechen`
  }
}

function done(m: Machine, op: Op, addr: number | null, patch: Partial<Machine>): Machine {
  return {
    ...m,
    ...patch,
    pending: null,
    status: READY,
    statusIsError: false,
    last: addr ?? m.last,
    protocol: m.recording ? [...m.protocol, protocolLine(op, addr, m.withComment)] : m.protocol,
  }
}

export function reduce(m: Machine, a: Action): Machine {
  switch (a.type) {
    case 'op': {
      if (m.pending) return m.pending.op === a.op ? reduce(m, { type: 'cancel' }) : m
      if (!MEMORY_OPS.includes(a.op)) return done(m, a.op, null, { ac: execAc(a.op, m.ac) })
      return { ...m, pending: { op: a.op, stage: 'address' }, status: promptFor(a.op), statusIsError: false }
    }
    case 'cell': {
      const p = m.pending
      if (!p || p.stage !== 'address' || m.alert) return m
      const addr = a.addr
      const cell = m.mem[addr]
      switch (p.op) {
        case 'LDA':
          return done(m, 'LDA', addr, { ac: cell })
        case 'STA':
          return done(m, 'STA', addr, { mem: m.mem.with(addr, m.ac) })
        case 'OUTM':
          return done(m, 'OUTM', addr, { output: cell })
        case 'INM':
          return { ...m, pending: { op: 'INM', stage: 'data', addr }, status: DATA_PROMPT, statusIsError: false, last: addr }
        default: {
          const r = execAlu(p.op, m.ac, cell)
          if (r === null) return { ...m, alert: DIV_ZERO }
          return done(m, p.op, addr, { ac: r })
        }
      }
    }
    case 'commit': {
      const p = m.pending
      if (!p || p.stage !== 'data') return m
      return done(m, 'INM', p.addr, { mem: m.mem.with(p.addr, m.input), input: 0 })
    }
    case 'cancel': {
      const p = m.pending
      if (!p) return m
      const status = p.stage === 'data' ? 'Dateneingabe wurde abgebrochen!' : 'Auswahl der Adresse wurde abgebrochen!'
      return { ...m, pending: null, status, statusIsError: true, alert: null }
    }
    case 'toggleBit':
      return { ...m, input: m.input ^ (1 << a.bit) }
    case 'setInput':
      return { ...m, input: word(a.value) }
    case 'clearMemory':
      return { ...m, mem: new Array(MEMORY_SIZE).fill(0), last: null }
    case 'record':
      return { ...m, recording: a.on }
    case 'comment':
      return { ...m, withComment: a.on }
    case 'clearProtocol':
      return { ...m, protocol: [] }
    case 'dismissAlert':
      return { ...m, alert: null }
  }
}

/** Führt einen kompletten Befehl aus (für Guide und Tests). */
export function run(m: Machine, op: Op, addr?: number, input?: number): Machine {
  let s = reduce(m, { type: 'op', op })
  if (addr !== undefined) s = reduce(s, { type: 'cell', addr })
  if (input !== undefined) s = reduce(reduce(s, { type: 'setInput', value: input }), { type: 'commit' })
  return s
}

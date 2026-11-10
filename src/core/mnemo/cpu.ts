import {
  MEMORY_SIZE,
  OP_BY_CODE,
  STACK_START,
  WORD_MASK,
  opcodeOf,
  operandOf,
  toSigned,
  toWord,
  type OpInfo,
} from './isa'

export type Phase = 'fetch' | 'decode' | 'execute'
export type RunState = 'ready' | 'input' | 'halted' | 'error'

export interface InputRequest {
  address: number
}

const addr8 = (n: number) => ((n % MEMORY_SIZE) + MEMORY_SIZE) % MEMORY_SIZE

/**
 * Modellrechner MNemo: 256 Speicherzellen à 16 Bit, Akkumulator-Maschine mit Stack.
 * Ein Befehl läuft in drei Phasen ab (fetch, decode, execute); step() führt einen ganzen Befehl aus.
 */
export class Cpu {
  mem: number[]
  ac = 0
  pc = 0
  ir = 0
  ar = 0
  dr = 0
  sp = STACK_START
  bp = STACK_START
  /** Phase, die als Nächstes ausgeführt wird. */
  phase: Phase = 'fetch'
  state: RunState = 'ready'
  error: string | null = null
  input: InputRequest | null = null
  output: number[] = []
  steps = 0
  private op: OpInfo | null = null
  private image: number[]

  constructor(image: number[] = new Array(MEMORY_SIZE).fill(0)) {
    this.image = image.slice()
    this.mem = image.slice()
  }

  reset(image?: number[]) {
    if (image) this.image = image.slice()
    this.mem = this.image.slice()
    this.ac = this.pc = this.ir = this.ar = this.dr = 0
    this.sp = this.bp = STACK_START
    this.phase = 'fetch'
    this.state = 'ready'
    this.error = null
    this.input = null
    this.output = []
    this.steps = 0
    this.op = null
  }

  private read(address: number) {
    this.ar = addr8(address)
    this.dr = this.mem[this.ar]
    return this.dr
  }

  private write(address: number, value: number) {
    this.ar = addr8(address)
    this.dr = value & WORD_MASK
    this.mem[this.ar] = this.dr
  }

  private push(value: number) {
    this.write(this.sp, value)
    this.sp = addr8(this.sp - 1)
  }

  private pop() {
    this.sp = addr8(this.sp + 1)
    return this.read(this.sp)
  }

  private fail(message: string) {
    this.state = 'error'
    this.error = message
  }

  /** Führt genau eine Phase aus. */
  microStep() {
    if (this.state !== 'ready') return
    if (this.phase === 'fetch') {
      this.ir = this.read(this.pc)
      this.pc = addr8(this.pc + 1)
      this.phase = 'decode'
    } else if (this.phase === 'decode') {
      this.op = OP_BY_CODE.get(opcodeOf(this.ir)) ?? null
      if (!this.op) {
        this.pc = addr8(this.pc - 1)
        this.phase = 'fetch'
        return this.fail(`Ungültiger Befehl (${this.ir}) an Adresse ${this.pc}.`)
      }
      this.phase = 'execute'
    } else {
      this.execute(this.op!, operandOf(this.ir))
      this.steps++
      if ((this.state as RunState) !== 'input') this.phase = 'fetch'
    }
  }

  /** Führt den (Rest des) aktuellen Befehl(s) aus. */
  step() {
    if (this.state !== 'ready') return
    do this.microStep()
    while (this.state === 'ready' && this.phase !== 'fetch')
  }

  provideInput(value: number) {
    if (this.state !== 'input' || !this.input) return
    this.write(this.input.address, toWord(value))
    this.input = null
    this.state = 'ready'
    this.phase = 'fetch'
  }

  private requestInput(address: number) {
    this.ar = addr8(address)
    this.input = { address: this.ar }
    this.state = 'input'
  }

  private arith(name: string, value: number) {
    const a = this.ac
    switch (name) {
      case 'add': return a + value
      case 'sub': return a - value
      case 'and': return a & value
      case 'or': return a | value
      case 'xor': return a ^ value
      case 'mul': return Math.imul(toSigned(a), toSigned(value))
      case 'div':
        if (value === 0) {
          this.fail('Division durch Null.')
          return a
        }
        return Math.trunc(toSigned(a) / toSigned(value))
    }
    return a
  }

  private execute(op: OpInfo, x: number) {
    const s = this.sp + x
    const b = this.bp + x
    const ac = toSigned(this.ac)
    const jump = (cond: boolean) => {
      this.ar = x
      if (cond) this.pc = x
    }
    switch (op.name) {
      case 'lda': this.ac = this.read(x); break
      case 'sta': this.write(x, this.ac); break
      case 'ldas': this.ac = this.read(s); break
      case 'stas': this.write(s, this.ac); break
      case 'ldab': this.ac = this.read(b); break
      case 'stab': this.write(b, this.ac); break
      case 'spbp': this.bp = this.sp; break
      case 'bpsp': this.sp = this.bp; break
      case 'neg': this.ac = ~this.ac & WORD_MASK; break
      case 'inc': this.ac = toWord(this.ac + 1); break
      case 'dec': this.ac = toWord(this.ac - 1); break
      case 'shl': this.ac = (this.ac << 1) & WORD_MASK; break
      case 'shr': this.ac = this.ac >>> 1; break
      case 'psh': this.push(this.ac); break
      case 'pop': this.ac = this.pop(); break
      case 'pshm': this.push(this.read(x)); break
      case 'popm': this.write(x, this.pop()); break
      case 'pshb': this.push(this.bp); break
      case 'popb': this.bp = addr8(this.pop()); break
      case 'outm': this.output.push(this.read(x)); break
      case 'outs': this.output.push(this.read(s)); break
      case 'outb': this.output.push(this.read(b)); break
      case 'inm': this.requestInput(x); break
      case 'ins': this.requestInput(s); break
      case 'inb': this.requestInput(b); break
      case 'jmp': jump(true); break
      case 'jms': jump(ac < 0); break
      case 'jpl': jump(ac > 0); break
      case 'jze': jump(ac === 0); break
      case 'jnm': jump(ac >= 0); break
      case 'jnp': jump(ac <= 0); break
      case 'jnz': jump(ac !== 0); break
      case 'jsr': this.push(this.pc); this.pc = x; break
      case 'rtn': this.pc = addr8(this.pop()); break
      case 'stop':
        this.pc = addr8(this.pc - 1)
        this.state = 'halted'
        break
      default: {
        const m = /^(add|sub|and|or|xor|mul|div)([sb]?)$/.exec(op.name)
        if (!m) return this.fail(`Unbekannter Befehl ${op.name}.`)
        const value = this.read(m[2] === 's' ? s : m[2] === 'b' ? b : x)
        const result = this.arith(m[1], value)
        if (this.state !== 'error') this.ac = toWord(result)
      }
    }
  }
}

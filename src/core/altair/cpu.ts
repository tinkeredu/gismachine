import { MEMORY_SIZE, OP_BY_CODE, toSigned, toWord } from './isa'

export type RunState = 'ready' | 'input' | 'halted' | 'error'

export class Cpu {
  mem: number[]
  ac = 0
  pc = 0
  ir = 0
  ar = 0
  dr = 0
  steps = 0
  state: RunState = 'ready'
  inputAddress: number | null = null
  error: string | null = null
  output: number[] = []

  constructor(memory: readonly number[] = Array(MEMORY_SIZE).fill(0)) {
    this.mem = Array.from({ length: MEMORY_SIZE }, (_, i) => toWord(memory[i] ?? 0))
  }

  loadMemory(memory: readonly number[]) {
    this.mem = Array.from({ length: MEMORY_SIZE }, (_, i) => toWord(memory[i] ?? 0))
    this.reset()
  }

  setWord(address: number, value: number) {
    this.mem[address & 255] = toWord(value)
  }

  reset() {
    this.ac = this.pc = this.ir = this.ar = this.dr = this.steps = 0
    this.state = 'ready'
    this.inputAddress = this.error = null
    this.output = []
  }

  private read(address: number) {
    this.ar = address & 255
    this.dr = this.mem[this.ar]
    return this.dr
  }

  private write(address: number, value: number) {
    this.ar = address & 255
    this.dr = toWord(value)
    this.mem[this.ar] = this.dr
  }

  step() {
    if (this.state !== 'ready') return
    this.ir = this.read(this.pc)
    const code = this.ir >>> 8
    const x = this.ir & 255
    if (!OP_BY_CODE.has(code)) {
      this.state = 'error'
      this.error = `Unbekannter Operationscode ${code} an Adresse ${this.pc}.`
      return
    }
    this.pc = (this.pc + 1) & 255
    const signed = toSigned(this.ac)
    switch (code) {
      case 0: break
      case 1: this.ac = this.read(x); break
      case 2: this.write(x, this.ac); break
      case 9: this.ac = toWord(this.ac + this.read(x)); break
      case 10: this.ac = toWord(this.ac - this.read(x)); break
      case 11: this.ac = toWord(~this.ac); break
      case 12: this.ac = toWord(this.ac + 1); break
      case 13: this.ac = toWord(this.ac - 1); break
      case 24:
        this.output.push(this.read(x))
        if (this.output.length > 1000) this.output.shift()
        break
      case 25: this.inputAddress = x; this.ar = x; this.state = 'input'; break
      case 30: this.pc = x; break
      case 31: if (signed < 0) this.pc = x; break
      case 32: if (signed > 0) this.pc = x; break
      case 33: if (signed === 0) this.pc = x; break
      case 34: if (signed >= 0) this.pc = x; break
      case 35: if (signed <= 0) this.pc = x; break
      case 36: if (signed !== 0) this.pc = x; break
      case 39: this.pc = (this.pc - 1) & 255; this.state = 'halted'; break
      case 40: this.ac &= this.read(x); break
      case 41: this.ac |= this.read(x); break
      case 42: this.ac = toWord(this.ac << 1); break
      case 43: this.ac >>>= 1; break
      case 44: this.ac ^= this.read(x); break
    }
    this.steps++
  }

  provideInput(value: number) {
    if (this.state !== 'input' || this.inputAddress === null) return
    this.write(this.inputAddress, value)
    this.inputAddress = null
    this.state = 'ready'
  }
}

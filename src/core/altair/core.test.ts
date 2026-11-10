import { describe, expect, it } from 'vitest'
import { Cpu } from './cpu'
import { EXAMPLES } from './examples'
import { binary, disassemble, encode as e, OPS, toSigned } from './isa'
import { isMemory, parseMemory, parseNumber, parsePc1, serializeMemory, serializePc1 } from './storage'

function execute(words: number[], data: Record<number, number> = {}, ac = 0) {
  const cpu = new Cpu(words)
  cpu.ac = ac
  Object.entries(data).forEach(([a, value]) => { cpu.mem[Number(a)] = value })
  cpu.step()
  return cpu
}

describe('Altair-Befehlssatz', () => {
  it('uses the sparse opcode numbers from the Altair reference, not MNemo indices', () => {
    expect(OPS).toHaveLength(23)
    expect(new Set(OPS.map((op) => op.code)).size).toBe(23)
    expect(Object.fromEntries(OPS.map(({ name, code }) => [name, code]))).toEqual({
      NOP: 0, LDA: 1, STA: 2, ADD: 9, SUB: 10, NEG: 11, INC: 12, DEC: 13,
      OUTM: 24, INM: 25, JMP: 30, JMS: 31, JPL: 32, JZE: 33, JNM: 34,
      JNP: 35, JNZ: 36, STOP: 39, AND: 40, OR: 41, SHL: 42, SHR: 43, XOR: 44,
    })
    expect(OPS.find((op) => op.name === 'OUTM')?.code).toBe(24)
    expect(OPS.find((op) => op.name === 'STOP')?.code).toBe(39)
    expect(e(24, 8)).toBe(0x1808)
    expect(binary(e(24, 8))).toBe('0001 1000 0000 1000')
  })
  it('decodes instructions, ignores unused operand bytes, and identifies invalid codes', () => {
    expect(disassemble(e(9, 8))).toBe('ADD 8')
    expect(disassemble(e(39, 255))).toBe('STOP')
    expect(disassemble(0)).toBe('NOP')
    expect(disassemble(e(255))).toBe('? (255)')
  })
})

describe('16-Bit-CPU', () => {
  it('runs NOP, loads and stores memory', () => {
    expect(execute([0]).pc).toBe(1)
    expect(execute([e(1, 8)], { 8: 0xf123 }).ac).toBe(0xf123)
    expect(execute([e(2, 8)], {}, 0xabcd).mem[8]).toBe(0xabcd)
  })
  it.each([
    [9, 65535, 1, 0], [9, 32767, 1, 32768], [10, 0, 1, 65535],
    [40, 0b1100, 0b1010, 0b1000], [41, 0b1100, 0b1010, 0b1110], [44, 0b1100, 0b1010, 0b0110],
  ])('executes opcode %i with AC %i and memory %i → %i', (code, ac, operand, result) => {
    expect(execute([e(code, 8)], { 8: operand }, ac).ac).toBe(result)
  })
  it.each([
    [11, 0, 65535], [11, 13, 65522], [12, 65535, 0], [13, 0, 65535],
    [42, 32769, 2], [43, 32769, 16384],
  ])('executes unary opcode %i with AC %i → %i', (code, ac, result) => {
    expect(execute([e(code, 199)], {}, ac).ac).toBe(result)
  })
  it.each([30, 31, 32, 33, 34, 35, 36])('evaluates signed conditions for jump %i', (code) => {
    for (const ac of [0, 1, 32767, 32768, 65535]) {
      const signed = toSigned(ac)
      const shouldJump = ({ 30: true, 31: signed < 0, 32: signed > 0, 33: signed === 0, 34: signed >= 0, 35: signed <= 0, 36: signed !== 0 } as Record<number, boolean>)[code]
      expect(execute([e(code, 77)], {}, ac).pc).toBe(shouldJump ? 77 : 1)
    }
  })
  it('waits at INM, writes a 16-bit value, then continues', () => {
    const cpu = execute([e(25, 8), e(24, 8), e(39)])
    expect(cpu.state).toBe('input')
    expect(cpu.inputAddress).toBe(8)
    cpu.step()
    expect(cpu.steps).toBe(1)
    cpu.provideInput(-1)
    expect(cpu.mem[8]).toBe(65535)
    expect(cpu.state).toBe('ready')
    cpu.step()
    expect(cpu.output).toEqual([65535])
    cpu.step()
    expect(cpu.state).toBe('halted')
    expect(cpu.pc).toBe(2)
    cpu.step()
    expect(cpu.steps).toBe(3)
    cpu.provideInput(123)
    expect(cpu.mem[8]).toBe(65535)
  })
  it('reports unknown opcodes without moving the PC or corrupting memory', () => {
    const cpu = execute([e(3, 8)])
    expect(cpu.state).toBe('error')
    expect(cpu.pc).toBe(0)
    expect(cpu.error).toContain('Operationscode 3')
  })
  it('wraps the program counter after address 255', () => {
    const cpu = new Cpu()
    cpu.pc = 255
    cpu.step()
    expect(cpu.pc).toBe(0)
  })
  it('supports self-modifying programs', () => {
    const cpu = new Cpu([e(2, 1), e(0)])
    cpu.ac = e(39)
    cpu.step(); cpu.step()
    expect(cpu.state).toBe('halted')
  })
  it('resets registers and output but retains memory (including runtime changes)', () => {
    const cpu = execute([e(2, 8), e(24, 8)], {}, 42)
    cpu.step(); cpu.reset()
    expect(cpu.pc).toBe(0)
    expect(cpu.ac).toBe(0)
    expect(cpu.output).toEqual([])
    expect(cpu.state).toBe('ready')
    expect(cpu.mem[8]).toBe(42)
  })
  it('bounds the output history for infinite loops', () => {
    const cpu = new Cpu(EXAMPLES[3].memory)
    for (let i = 0; i < 10000; i++) cpu.step()
    expect(cpu.output).toHaveLength(1000)
    expect(cpu.output.at(-1)).toBe(2500)
  })
})

describe('Beispielprogramme', () => {
  it('runs the introductory output program', () => {
    const cpu = new Cpu(EXAMPLES[0].memory)
    cpu.step(); cpu.step()
    expect(cpu.output).toEqual([13])
    expect(cpu.state).toBe('halted')
  })
  it('adds two inputs to 42', () => {
    const cpu = new Cpu(EXAMPLES[1].memory)
    for (let i = 0; i < 20 && cpu.state !== 'halted'; i++) {
      cpu.step()
      if (cpu.state === 'input') cpu.provideInput(cpu.inputAddress === 8 ? 12 : 30)
    }
    expect(cpu.output).toEqual([42])
    expect(cpu.mem[10]).toBe(42)
    expect(cpu.state).toBe('halted')
  })
  it('counts down and lights every output LED at the end', () => {
    const cpu = new Cpu(EXAMPLES[2].memory)
    cpu.step(); cpu.provideInput(3)
    for (let i = 0; i < 50 && cpu.state === 'ready'; i++) cpu.step()
    expect(cpu.output).toEqual([3, 2, 1, 0, 65535])
    expect(cpu.state).toBe('halted')
  })
})

describe('Dateien und Eingabevalidierung', () => {
  it('round-trips the original PC1 binary format in little-endian order', () => {
    const memory = Array.from({ length: 256 }, (_, i) => i * 257)
    memory[0] = 0x1808
    const buffer = serializePc1(memory)
    expect(buffer.byteLength).toBe(512)
    expect([...new Uint8Array(buffer).slice(0, 4)]).toEqual([8, 24, 1, 1])
    expect(parsePc1(buffer)).toEqual(memory)
  })
  it('rejects truncated PC1 files and invalid memories', () => {
    for (const length of [0, 1, 511, 513, 1024]) expect(() => parsePc1(new ArrayBuffer(length))).toThrow()
    expect(() => serializePc1([1, 2])).toThrow()
  })
  it('round-trips all 256 words in the versioned web format', () => {
    const memory = Array.from({ length: 256 }, (_, i) => i * 257)
    expect(parseMemory(serializeMemory(memory))).toEqual(memory)
    expect(isMemory(memory)).toBe(true)
  })
  it.each(['', 'null', '{}', '[]', '{"format":"gisaltair","version":2,"memory":[]}', '{"format":"other","version":1,"memory":[]}'])('rejects malformed files: %s', (text) => {
    expect(() => parseMemory(text)).toThrow()
  })
  it('rejects corrupt or out-of-range words', () => {
    for (const invalid of [-1, 65536, 0.5, '0', null]) {
      const memory: unknown[] = Array(256).fill(0); memory[42] = invalid
      expect(isMemory(memory)).toBe(false)
    }
  })
  it.each([['-32768', -32768], ['65535', 65535], ['0xFFFF', 65535], ['0b1010', 10], ['0', 0]])('parses %s as %i', (text, n) => {
    expect(parseNumber(text)).toBe(n)
  })
  it.each(['', ' ', '65536', '-32769', '3.14', '1e3', 'NaN', '123abc', '0x', '0b2', 'Infinity'])('rejects invalid input %s', (text) => {
    expect(parseNumber(text)).toBeNull()
  })
  it('validates addresses separately', () => {
    expect(parseNumber('256', 255, 0)).toBeNull()
    expect(parseNumber('-1', 255, 0)).toBeNull()
    expect(parseNumber('0xff', 255, 0)).toBe(255)
  })
})

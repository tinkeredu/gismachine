export type OperandKind = 'none' | 'var' | 'label' | 'const'

export interface OpInfo {
  code: number
  name: string
  operand: OperandKind
}

const TABLE: [string, OperandKind][] = [
  ['lda', 'var'], ['sta', 'var'], ['ldas', 'const'], ['stas', 'const'], ['ldab', 'const'], ['stab', 'const'],
  ['spbp', 'none'], ['bpsp', 'none'],
  ['add', 'var'], ['sub', 'var'], ['neg', 'none'], ['inc', 'none'], ['dec', 'none'],
  ['adds', 'const'], ['subs', 'const'], ['addb', 'const'], ['subb', 'const'],
  ['psh', 'none'], ['pop', 'none'], ['pshm', 'var'], ['popm', 'var'], ['pshb', 'none'], ['popb', 'none'],
  ['outm', 'var'], ['inm', 'var'], ['outs', 'const'], ['ins', 'const'], ['outb', 'const'], ['inb', 'const'],
  ['jmp', 'label'], ['jms', 'label'], ['jpl', 'label'], ['jze', 'label'], ['jnm', 'label'], ['jnp', 'label'],
  ['jnz', 'label'], ['jsr', 'label'], ['rtn', 'none'], ['stop', 'none'],
  ['and', 'var'], ['or', 'var'], ['shl', 'none'], ['shr', 'none'], ['xor', 'var'],
  ['ands', 'const'], ['andb', 'const'], ['ors', 'const'], ['orb', 'const'], ['xors', 'const'], ['xorb', 'const'],
  ['mul', 'var'], ['muls', 'const'], ['mulb', 'const'], ['div', 'var'], ['divs', 'const'], ['divb', 'const'],
]

/** Opcode = 1-based position in the table (identical to the original MNemo 3.2). */
export const OPS: OpInfo[] = TABLE.map(([name, operand], i) => ({ code: i + 1, name, operand }))

export const OP_BY_NAME = new Map(OPS.map((op) => [op.name, op]))
export const OP_BY_CODE = new Map(OPS.map((op) => [op.code, op]))

export const MEMORY_SIZE = 256
export const WORD_MASK = 0xffff
export const STACK_START = 255

export const encode = (opcode: number, operand: number) => ((opcode & 0xff) << 8) | (operand & 0xff)
export const opcodeOf = (word: number) => (word >> 8) & 0xff
export const operandOf = (word: number) => word & 0xff
export const toSigned = (word: number) => (word & 0x8000 ? word - 0x10000 : word)
export const toWord = (n: number) => ((n % 0x10000) + 0x10000) % 0x10000

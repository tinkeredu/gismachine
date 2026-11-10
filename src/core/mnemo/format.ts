import { OP_BY_CODE, opcodeOf, operandOf } from './isa'

const pad3 = (n: number) => String(n).padStart(3, '0')

/** Cell content as the original shows it: plain number, or mnemonic + operand byte ("?" if invalid). */
export function formatWord(word: number): string {
  const hi = opcodeOf(word)
  if (hi === 0) return String(word)
  const name = OP_BY_CODE.get(hi)?.name ?? '?'
  return `${name.padEnd(4)} ${String(operandOf(word)).padStart(3)}`
}

export function formatMemoryCell(addr: number, word: number): string {
  const hi = opcodeOf(word)
  if (hi === 0) return `${pad3(addr)}:   ${String(word).padStart(5)}`
  return `${pad3(addr)}: ${formatWord(word)}`
}

/** Register IR: "%-4s  %d". */
export function formatInstruction(word: number): string {
  const hi = opcodeOf(word)
  const name = hi === 0 ? '' : (OP_BY_CODE.get(hi)?.name ?? '?')
  return `${name.padEnd(4)}  ${hi === 0 ? word : operandOf(word)}`
}

/** Output / AC: unsigned value, plus the negative reading for values >= 32768. */
export function formatValue(word: number): string {
  return word < 0x8000 ? String(word) : `${word} (-${0x10000 - word})`
}

export function formatStackCell(addr: number, word: number): string {
  return `${pad3(addr)}: ${formatValue(word).padStart(6)}`
}

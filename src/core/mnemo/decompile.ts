import { assemble } from './assembler'
import { MEMORY_SIZE, OP_BY_CODE, opcodeOf, operandOf, toSigned } from './isa'

const pad3 = (n: number) => String(n).padStart(3, '0')

/** Versucht den Speicher so aufzuteilen: Zellen 0…c-1 Befehle, c…ende Variablen (wie der MNemo-Assembler). */
function tryLayout(memory: readonly number[], codeSize: number, lastUsed: number): string | null {
  const varName = (addr: number) => `z${pad3(addr)}`
  const labelName = (addr: number) => `m${pad3(addr)}`
  const labelTargets = new Set<number>()
  const lines: string[] = []
  let end = lastUsed

  for (let addr = 0; addr < codeSize; addr++) {
    const op = OP_BY_CODE.get(opcodeOf(memory[addr]))
    if (!op) return null
    const operand = operandOf(memory[addr])
    if (op.operand === 'none' && operand !== 0) return null
    if (op.operand === 'var') {
      if (operand < codeSize) return null
      end = Math.max(end, operand)
    }
    if (op.operand === 'label') {
      if (operand > codeSize) return null
      labelTargets.add(operand)
    }
  }

  for (let addr = 0; addr < codeSize; addr++) {
    if (labelTargets.has(addr)) lines.push(labelName(addr))
    const op = OP_BY_CODE.get(opcodeOf(memory[addr]))!
    const operand = operandOf(memory[addr])
    const arg = op.operand === 'none' ? '' : op.operand === 'var' ? ` ${varName(operand)}` : op.operand === 'label' ? ` ${labelName(operand)}` : ` ${operand}`
    lines.push(`\t${op.name}${arg}\t; ${pad3(addr)}`)
  }
  if (labelTargets.has(codeSize)) lines.push(labelName(codeSize))
  if (codeSize > 0 && codeSize <= end) lines.push('')
  for (let addr = codeSize; addr <= end; addr++) lines.push(`${varName(addr)}\tdef ${toSigned(memory[addr])}\t; ${pad3(addr)}`)
  return lines.join('\n') + '\n'
}

/**
 * Erzeugt aus einem Speicherabbild einen MNemo-Quelltext, der beim Übersetzen exakt
 * denselben Speicher ergibt. Variablen heißen z<Adresse>, Sprungmarken m<Adresse>.
 * Liefert null, wenn das Abbild nicht als MNemo-Programm darstellbar ist
 * (z. B. Daten mitten im Programmcode).
 */
export function decompile(memory: readonly number[]): string | null {
  if (memory.length !== MEMORY_SIZE) return null
  let end = MEMORY_SIZE - 1
  while (end >= 0 && memory[end] === 0) end--
  if (end < 0) return null

  let firstInvalid = 0
  while (firstInvalid <= end && OP_BY_CODE.has(opcodeOf(memory[firstInvalid]))) firstInvalid++

  for (let codeSize = firstInvalid; codeSize >= 0; codeSize--) {
    const source = tryLayout(memory, codeSize, end)
    if (source === null) continue
    const result = assemble(source)
    if (result.ok && result.memory.every((w, i) => w === memory[i])) return source
  }
  return null
}

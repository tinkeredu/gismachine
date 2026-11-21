import { assemble } from './assembler'
import { MEMORY_SIZE, OP_BY_CODE, opcodeOf, operandOf, toSigned } from './isa'

const pad3 = (n: number) => String(n).padStart(3, '0')

function namesByRole(roles: ReadonlyMap<number, string>): Map<number, string> {
  const counts = new Map<string, number>()
  for (const role of roles.values()) counts.set(role, (counts.get(role) ?? 0) + 1)
  return new Map(Array.from(roles, ([address, role]) => [address, counts.get(role) === 1 ? role : `${role}${pad3(address)}`]))
}

/** Versucht den Speicher so aufzuteilen: Zellen 0…c-1 Befehle, c…ende Variablen (wie der MNemo-Assembler). */
function tryLayout(memory: readonly number[], codeSize: number, lastUsed: number): string | null {
  const uses = new Map<number, Set<string>>()
  const targets = new Map<number, boolean>()
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
      const ops = uses.get(operand) ?? new Set<string>()
      ops.add(op.name)
      uses.set(operand, ops)
    }
    if (op.operand === 'label') {
      if (operand > codeSize) return null
      targets.set(operand, targets.get(operand) === true || operand <= addr)
    }
  }

  const variables = namesByRole(new Map(Array.from(uses, ([address, ops]) => [
    address,
    ops.has('inm') ? 'eingabe' : ops.has('outm') ? (ops.has('sta') ? 'ergebnis' : 'ausgabe') : ops.has('sta') ? 'zwischenwert' : 'wert',
  ])))
  const labels = namesByRole(new Map(Array.from(targets, ([address, loop]) => [
    address,
    loop ? 'schleife' : address < codeSize && OP_BY_CODE.get(opcodeOf(memory[address]))?.name === 'stop' ? 'programmende' : 'sprungziel',
  ])))

  if (codeSize === 0) lines.push('; Keine passende Befehlsfolge erkannt. Der Speicherinhalt steht hier als Daten.')
  for (let addr = 0; addr < codeSize; addr++) {
    if (labels.has(addr)) lines.push(labels.get(addr)!)
    const op = OP_BY_CODE.get(opcodeOf(memory[addr]))!
    const operand = operandOf(memory[addr])
    const arg = op.operand === 'none' ? '' : op.operand === 'var' ? ` ${variables.get(operand)}` : op.operand === 'label' ? ` ${labels.get(operand)}` : ` ${operand}`
    lines.push(`\t${op.name.toUpperCase()}${arg}`)
  }
  if (labels.has(codeSize)) lines.push(labels.get(codeSize)!)
  if (codeSize > 0 && codeSize <= end) lines.push('')
  for (let addr = codeSize; addr <= end; addr++) {
    const name = variables.get(addr) ?? `${memory[addr] === 0 ? 'reserve' : 'daten'}${pad3(addr)}`
    lines.push(`${name}\tDEF ${toSigned(memory[addr])}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * Erzeugt aus einem Speicherabbild einen MNemo-Quelltext, der beim Übersetzen exakt
 * denselben Speicher ergibt. Namen werden aus der Verwendung der Zellen abgeleitet.
 * Nicht darstellbare Befehlsfolgen bleiben als Daten erhalten.
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

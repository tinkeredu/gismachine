import type { MnemoDocument } from '../suite'
import { assemble } from './assembler'
import { decompile } from './decompile'

export type MnemoStartMode = 'resume' | 'empty' | 'import'

export interface MnemoProgram extends MnemoDocument {
  lineOfAddress: (number | null)[]
  generated: boolean
}

const emptyDocument: MnemoDocument = { source: '', fileName: 'programm.mno' }

export function openMnemoProgram(memory: readonly number[], mode: MnemoStartMode, stored: MnemoDocument | null, linked?: MnemoDocument): MnemoProgram {
  const existing = linked ?? (mode === 'resume' ? stored : null)
  if (existing) {
    const compiled = assemble(existing.source)
    const sameCode = compiled.ok && memory.slice(0, compiled.codeSize).every((word, addr) => word === compiled.memory[addr])
    return { ...existing, lineOfAddress: sameCode ? compiled.lineOfAddress : [], generated: false }
  }
  const source = mode === 'import' ? decompile(memory) : null
  if (source === null) return { ...emptyDocument, lineOfAddress: [], generated: false }

  const result = assemble(source)
  return { source, fileName: 'uebernommen.mno', lineOfAddress: result.lineOfAddress, generated: true }
}

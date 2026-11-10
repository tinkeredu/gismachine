export const MEMORY_SIZE = 256
export const WORD_MASK = 0xffff

export interface Instruction {
  code: number
  name: string
  operand: boolean
  group: string
  description: string
  basic: boolean
}

export const OPS: Instruction[] = [
  { code: 0, name: 'NOP', operand: false, group: 'Steuerung', description: 'Leerbefehl: Fahre mit dem nächsten Befehl fort.', basic: true },
  { code: 1, name: 'LDA', operand: true, group: 'Datentransport', description: 'Lade den Inhalt von Zelle X in den Akkumulator AC.', basic: true },
  { code: 2, name: 'STA', operand: true, group: 'Datentransport', description: 'Speichere den AC in Zelle X.', basic: true },
  { code: 9, name: 'ADD', operand: true, group: 'Arithmetik und Logik', description: 'Addiere Zelle X zum AC (16 Bit, mit Überlauf).', basic: true },
  { code: 10, name: 'SUB', operand: true, group: 'Arithmetik und Logik', description: 'Subtrahiere Zelle X vom AC (16 Bit, mit Überlauf).', basic: true },
  { code: 11, name: 'NEG', operand: false, group: 'Arithmetik und Logik', description: 'Invertiere jedes Bit im AC (Einerkomplement, nicht arithmetisches Minus).', basic: false },
  { code: 12, name: 'INC', operand: false, group: 'Arithmetik und Logik', description: 'Erhöhe den AC um 1.', basic: true },
  { code: 13, name: 'DEC', operand: false, group: 'Arithmetik und Logik', description: 'Vermindere den AC um 1.', basic: true },
  { code: 24, name: 'OUTM', operand: true, group: 'Datentransport', description: 'Gib den Inhalt von Zelle X an die Ausgabe-LEDs aus.', basic: true },
  { code: 25, name: 'INM', operand: true, group: 'Datentransport', description: 'Warte auf eine Eingabe und speichere sie in Zelle X.', basic: true },
  { code: 30, name: 'JMP', operand: true, group: 'Sprünge', description: 'Unbedingter Sprung zu Adresse X.', basic: true },
  { code: 31, name: 'JMS', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC negativ ist.', basic: true },
  { code: 32, name: 'JPL', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC positiv ist (größer 0).', basic: true },
  { code: 33, name: 'JZE', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC gleich 0 ist.', basic: true },
  { code: 34, name: 'JNM', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC nicht negativ ist (größer oder gleich 0).', basic: false },
  { code: 35, name: 'JNP', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC nicht positiv ist (kleiner oder gleich 0).', basic: false },
  { code: 36, name: 'JNZ', operand: true, group: 'Sprünge', description: 'Springe zu X, falls der AC nicht gleich 0 ist.', basic: false },
  { code: 39, name: 'STOP', operand: false, group: 'Steuerung', description: 'Beende die Programmausführung. Ein Reset ermöglicht einen neuen Lauf.', basic: true },
  { code: 40, name: 'AND', operand: true, group: 'Arithmetik und Logik', description: 'Verknüpfe Zelle X und AC bitweise mit UND.', basic: false },
  { code: 41, name: 'OR', operand: true, group: 'Arithmetik und Logik', description: 'Verknüpfe Zelle X und AC bitweise mit ODER.', basic: false },
  { code: 42, name: 'SHL', operand: false, group: 'Arithmetik und Logik', description: 'Verschiebe den AC um ein Bit nach links; rechts wird 0 eingefügt.', basic: false },
  { code: 43, name: 'SHR', operand: false, group: 'Arithmetik und Logik', description: 'Verschiebe den AC um ein Bit nach rechts; links wird 0 eingefügt.', basic: false },
  { code: 44, name: 'XOR', operand: true, group: 'Arithmetik und Logik', description: 'Verknüpfe Zelle X und AC bitweise mit EXKLUSIV-ODER.', basic: false },
]

export const OP_BY_CODE = new Map(OPS.map((op) => [op.code, op]))
export const toWord = (n: number) => n & WORD_MASK
export const toSigned = (n: number) => n & 0x8000 ? n - 0x10000 : n
export const encode = (code: number, address = 0) => ((code & 255) << 8) | (address & 255)
export const binary = (n: number, bits = 16) => n.toString(2).padStart(bits, '0').replace(/(.{4})(?=.)/g, '$1 ')
export const hex = (n: number, digits = 4) => n.toString(16).toUpperCase().padStart(digits, '0')
export const valueText = (n: number) => n >= 32768 ? `${n} (${toSigned(n)})` : String(n)
export function disassemble(word: number) {
  const op = OP_BY_CODE.get(word >>> 8)
  return op ? `${op.name}${op.operand ? ` ${word & 255}` : ''}` : `? (${word >>> 8})`
}

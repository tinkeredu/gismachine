import { encode as e, MEMORY_SIZE } from './isa'

const image = (words: number[], data: Record<number, number> = {}) => {
  const memory: number[] = Array(MEMORY_SIZE).fill(0)
  words.forEach((word, i) => { memory[i] = word })
  Object.entries(data).forEach(([address, word]) => { memory[Number(address)] = word })
  return memory
}

export const EXAMPLES = [
  { name: 'Zahl 13 ausgeben', description: 'OUTM 8 → STOP. In Zelle 8 steht die Zahl 13.', memory: image([e(24, 8), e(39)], { 8: 13 }) },
  { name: 'Zwei Zahlen addieren', description: 'Zwei Eingaben in Zelle 8 und 9, Summe in Zelle 10.', memory: image([e(25, 8), e(1, 8), e(25, 9), e(9, 9), e(2, 10), e(24, 10), e(39)]) },
  { name: 'Countdown', description: 'Zählt eine Eingabe bis 0 herunter, dann leuchten alle LEDs.', memory: image([e(25, 20), e(1, 20), e(2, 21), e(24, 21), e(33, 7), e(13), e(30, 2), e(11), e(2, 21), e(24, 21), e(39)]) },
  { name: 'Endlosschleife', description: 'Erhöht den AC und gibt ihn aus. Mit Pause anhalten.', memory: image([e(12), e(2, 8), e(24, 8), e(30, 0)]) },
]

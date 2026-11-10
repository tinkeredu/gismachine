import { useEffect, useRef, type ReactNode } from 'react'
import { formatInstruction, formatMemoryCell, formatStackCell, formatValue } from '../../../core/mnemo/format'
import { MEMORY_SIZE, STACK_START } from '../../../core/mnemo/isa'

export function GroupBox({ title, className = '', guide, children }: { title: string; className?: string; guide?: string; children: ReactNode }) {
  return (
    <section className={`group-box ${className}`} aria-label={title} data-guide={guide}>
      <span className="legend">{title}</span>
      {children}
    </section>
  )
}

export function Register({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs">{label}</span>
      <output
        className={`sunken block min-w-28 px-1 font-mono whitespace-pre ${highlight ? 'bg-hl!' : ''}`}
        aria-label={label}
      >
        {value}
      </output>
    </label>
  )
}

export function Accumulator({ value }: { value: number }) {
  return (
    <label className="block">
      <span className="block text-xs">AC (Accumulator)</span>
      <output aria-label="AC" className="acc block px-1 font-mono text-lg">
        {formatValue(value)}
      </output>
    </label>
  )
}

export function InstructionRegister({ value }: { value: number }) {
  return <Register label="IR (Instruction-Register)" value={formatInstruction(value)} />
}

interface MemoryListProps {
  memory: number[]
  pc: number
  ar: number
  followPc: boolean
  /** Scroll request: changes of `seq` scroll `addr` to the top. */
  jump: { addr: number; seq: number } | null
}

export function MemoryList({ memory, pc, ar, followPc, jump }: MemoryListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = listRef.current
    const row = list?.children[pc] as HTMLElement | undefined
    if (!followPc || !list || !row) return
    if (row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop - list.clientHeight / 3
    }
  }, [pc, followPc])
  useEffect(() => {
    const list = listRef.current
    const row = jump && (list?.children[jump.addr] as HTMLElement | undefined)
    if (list && row) list.scrollTop = row.offsetTop
  }, [jump])
  return (
    <div ref={listRef} role="listbox" aria-label="Speicher" tabIndex={0} className="sunken relative h-full overflow-y-auto overscroll-contain font-mono text-[13px] leading-[18px]">
      {Array.from({ length: MEMORY_SIZE }, (_, addr) => (
        <div
          key={addr}
          role="option"
          aria-selected={addr === pc}
          className={`px-1 whitespace-pre ${addr === pc ? 'bg-sel text-sel-fg' : addr === ar ? 'bg-hl' : ''}`}
        >
          {formatMemoryCell(addr, memory[addr])}
        </div>
      ))}
    </div>
  )
}

export function StackList({ memory, sp, bp }: { memory: number[]; sp: number; bp: number }) {
  const rows = []
  for (let addr = STACK_START; addr >= sp; addr--) {
    const marks = [addr === sp ? 'SP' : '', addr === bp ? 'BP' : ''].filter(Boolean).join(',')
    rows.push(
      <div key={addr} className={`flex gap-2 px-1 whitespace-pre ${addr === sp ? 'text-muted' : ''}`}>
        <span>{formatStackCell(addr, memory[addr])}</span>
        <span className="text-xs leading-[18px] text-info">{marks}</span>
      </div>,
    )
  }
  return (
    <div aria-label="Stack" className="sunken h-full min-h-32 overflow-y-auto font-mono text-[13px] leading-[18px]">
      {rows}
    </div>
  )
}

export function OutputList({ values }: { values: number[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [values.length])
  return (
    <div ref={ref} aria-label="Ausgabe" className="sunken h-full min-h-24 overflow-y-auto font-mono text-[13px] leading-[18px]">
      {values.map((v, i) => (
        <div key={i} className="px-1">
          {formatValue(v)}
        </div>
      ))}
    </div>
  )
}

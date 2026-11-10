import { useEffect, useRef, type ReactNode } from 'react'
import { formatBinary, formatOutput, memoryLine, toSigned } from '../../../core/cpudirect/machine'

export function GroupBox({ title, className = '', guide, children }: { title: ReactNode; className?: string; guide?: string; children: ReactNode }) {
  return (
    <section className={`group-box ${className}`} data-guide={guide}>
      <span className="legend">{title}</span>
      {children}
    </section>
  )
}

const BITS = Array.from({ length: 16 }, (_, i) => 15 - i)

function Nibbles({ render }: { render: (bit: number) => ReactNode }) {
  return (
    <div className="bit-groups flex flex-wrap justify-center gap-x-3 gap-y-2">
      {[0, 1].map((byte) => (
        <div key={byte} className="flex gap-2">
          {[0, 1].map((nib) => (
            <div key={nib} className="flex gap-1">
              {BITS.slice(byte * 8 + nib * 4, byte * 8 + nib * 4 + 4).map(render)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function AcDisplay({ value, decimal }: { value: number; decimal: boolean }) {
  return (
    <output aria-label="Akkumulator" className="acc block px-3 py-1.5 text-center font-mono text-lg font-bold tabular-nums">
      {decimal ? toSigned(value) : formatBinary(value)}
    </output>
  )
}

export function InputBits({ value, onToggle }: { value: number; onToggle: (bit: number) => void }) {
  return (
    <Nibbles
      render={(bit) => (
        <label key={bit} className="input-bit flex flex-col items-center justify-center text-[10px] text-muted">
          {bit}
          <input type="checkbox" className="h-5 w-5" aria-label={`Bit ${bit}`} checked={((value >> bit) & 1) === 1} onChange={() => onToggle(bit)} />
        </label>
      )}
    />
  )
}

export function OutputLeds({ value }: { value: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Nibbles render={(bit) => <span key={bit} title={`Bit ${bit}`} className={`cpud-led ${(value >> bit) & 1 ? 'on' : ''}`} />} />
      <output aria-label="Ausgabe dezimal" className="acc block py-1 text-center font-mono text-lg font-bold whitespace-pre text-(--out-fg)!">
        {formatOutput(value)}
      </output>
    </div>
  )
}

export function MemoryList({ memory, selectable, last, onSelect }: { memory: number[]; selectable: boolean; last: number | null; onSelect: (addr: number) => void }) {
  const lastRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: 'nearest' })
  }, [last])
  return (
    <div className="sunken flex h-full flex-col overflow-hidden">
      <div className="flex border-b border-line px-2 py-0.5 font-mono text-xs text-muted whitespace-pre">{'Adr.   ------ Inhalt ------'}</div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Speicher" aria-disabled={!selectable}>
        {memory.map((w, addr) => (
          <button
            key={addr}
            ref={addr === last ? lastRef : undefined}
            type="button"
            role="option"
            aria-selected={addr === last}
            disabled={!selectable}
            onClick={() => onSelect(addr)}
            className={`mem-row block w-full px-2 text-left font-mono text-[13px] leading-5 whitespace-pre ${addr === last ? 'bg-hl' : ''} ${selectable ? 'cursor-pointer' : ''}`}
          >
            {memoryLine(addr, w)}
          </button>
        ))}
      </div>
    </div>
  )
}

import { binary } from '../../../core/altair/isa'

export function Bits({ value, count = 8, label, onChange, disabled = false }: {
  value: number; count?: number; label: string; onChange?: (value: number) => void; disabled?: boolean
}) {
  return <div className={`bits bits-${count}`} role="group" aria-label={label}>
    {Array.from({ length: count }, (_, i) => count - 1 - i).map((bit) => {
      const on = Boolean(value & (1 << bit))
      return onChange ? <button key={bit} type="button" className={`bit-switch ${on ? 'is-on' : ''}`} aria-label={`${label} Bit ${bit} (Wert ${2 ** bit})`} aria-pressed={on} disabled={disabled} onClick={() => onChange(value ^ (1 << bit))}>
        <span className="bit-weight">{2 ** bit}</span><span className="switch-track"><span /></span><span className="bit-digit">{on ? 1 : 0}</span>
      </button> : <span key={bit} className={`led ${on ? 'is-on' : ''}`} aria-hidden="true" />
    })}
    {!onChange && <span className="sr-only">{binary(value, count)}</span>}
  </div>
}

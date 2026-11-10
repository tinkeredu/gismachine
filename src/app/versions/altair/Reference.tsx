import { useState } from 'react'
import { binary, OPS } from '../../../core/altair/isa'

export function Reference({ initialBasic = false }: { initialBasic?: boolean }) {
  const [basic, setBasic] = useState(initialBasic)
  const [search, setSearch] = useState('')
  const ops = OPS.filter((op) => (!basic || op.basic) && `${op.name} ${op.description} ${op.code} ${op.group}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <p>Altair-Befehlswort: <strong>8 Bit Operationscode + 8 Bit Adresse</strong>. Zahlen im Speicher sind 16 Bit breit. Der Adressteil wird bei Befehlen ohne X ignoriert.</p>
    <div className="reference-tools"><label>Suche <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Befehl, Nummer oder Erklärung" /></label><label><input type="checkbox" checked={basic} onChange={(e) => setBasic(e.target.checked)} /> Nur Grundbefehle</label></div>
    <div className="reference-table"><table><thead><tr><th>Befehl</th><th>Dez.</th><th>Binär (8 Bit)</th><th>Wirkung</th></tr></thead><tbody>
      {ops.map((op) => <tr key={op.code}><td><code>{op.name}{op.operand ? ' X' : ''}</code></td><td>{op.code}</td><td><code>{binary(op.code, 8)}</code></td><td>{op.description}</td></tr>)}
    </tbody></table>{ops.length === 0 && <p>Keine Befehle gefunden.</p>}</div>
    <p className="text-muted">23 Befehle nach dem beigefügten Altair-Befehlssatz. Die weiteren Mnemo-Befehle (Stack, Multiplikation usw.) gehören nicht zu diesem Modell.</p>
  </>
}

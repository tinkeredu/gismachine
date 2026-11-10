import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { HINTS, initialMachine, MEMORY_OPS, reduce, type Action, type Machine, type Op } from '../../core/cpudirect/machine'
import { transferMemory } from '../../core/suite'
import { parseNumber } from '../../core/altair/storage'
import { useStoredFlag } from '../skin'
import { AcDisplay, GroupBox, InputBits, MemoryList, OutputLeds } from './cpudirect/Panels'
import { GUIDE_STEPS } from '../guides/cpudirect'
import type { ViewProps } from '../viewProps'
import { AppHeader, Dialog, GuideOverlay, MenuBar, StatusBar } from '../ui'
import { REPO_URL } from '../../config'

type Doc = { title: string; src: string }

function NumberInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Text und Fehler gehören zum zuletzt übernommenen Wert; bei externer Änderung (z. B. 0 nach INM) wird neu gestartet.
  const [draft, setDraft] = useState({ value, text: String(value), error: false })
  const current = draft.value === value ? draft : { value, text: String(value), error: false }
  const text = current.text
  const error = current.error
  return (
    <form
      className="number-form"
      onSubmit={(e) => {
        e.preventDefault()
        const n = parseNumber(text, 65535, -32768)
        setDraft({ value, text, error: n === null })
        if (n !== null) onChange(n)
      }}
    >
      <label>
        Zahl (dezimal)
        <input
          aria-invalid={error}
          value={text}
          onChange={(e) => setDraft({ value, text: e.target.value, error: false })}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button type="submit" className="btn">
        übernehmen
      </button>
      {error && (
        <span className="field-error" role="alert">
          Ganze Zahl von -32768 bis 65535 eingeben (auch 0x… / 0b…).
        </span>
      )}
    </form>
  )
}

const DOCS: Record<string, Doc> = {
  hilfe: { title: 'Hilfe', src: './docs/cpud-hilfe.htm' },
  befehle: { title: 'Befehle', src: './docs/cpud-befehlssatz.htm' },
}

type Event = Action | { type: 'replace'; machine: Machine }
const machineReducer = (m: Machine, e: Event) => (e.type === 'replace' ? e.machine : reduce(m, e))

const guideState = (index: number) => GUIDE_STEPS.slice(0, index + 1).reduce((m, s) => s.apply?.(m) ?? m, initialMachine())

export function CpudirectView({ memory, onMemoryChange, info, versionMenu, skinItems, storageError }: ViewProps) {
  const [initial] = useState(() => ({ ...initialMachine(), mem: transferMemory(memory) }))
  const [m, dispatch] = useReducer(machineReducer, undefined, () => initial)
  const [acDecimal, toggleAcDecimal] = useStoredFlag('gismachine.cpud.acDecimal', true)
  const [showIncDec, toggleIncDec] = useStoredFlag('gismachine.cpud.incDec', true)
  const [showShift, toggleShift] = useStoredFlag('gismachine.cpud.shift', false)
  const [showNeg, toggleNeg] = useStoredFlag('gismachine.cpud.neg', false)
  const [showLogic, toggleLogic] = useStoredFlag('gismachine.cpud.logic', false)
  const [showImage, toggleShowImage] = useStoredFlag('gismachine.cpud.image', true)
  const [guideIndex, setGuideIndex] = useState<number | null>(null)
  const [beforeGuide, setBeforeGuide] = useState<Machine | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [about, setAbout] = useState(false)
  const guiding = guideIndex !== null

  // Das Programm (256 Speicherzellen) geht an die Shell: Versionswechsel und Autospeicherung.
  useEffect(() => {
    onMemoryChange(m.mem)
  })

  const modal = guiding || doc !== null || about || m.alert !== null
  useEffect(() => {
    if (modal) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'cancel' })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  const gotoGuideStep = useCallback((index: number) => {
    dispatch({ type: 'replace', machine: guideState(index) })
    setGuideIndex(index)
  }, [])

  const startGuide = () => {
    if (guiding) return
    setBeforeGuide(m)
    gotoGuideStep(0)
  }

  const closeGuide = useCallback(() => {
    setGuideIndex(null)
    if (beforeGuide) dispatch({ type: 'replace', machine: beforeGuide })
    setBeforeGuide(null)
  }, [beforeGuide])

  const pending = m.pending
  const selectingCell = pending?.stage === 'address' && !m.alert
  const enteringData = pending?.stage === 'data'

  useEffect(() => {
    if (guiding || !pending || window.matchMedia('(min-width: 72rem)').matches) return
    const target = pending.stage === 'address' ? 'speicher' : 'eingabe'
    document.querySelector(`[data-guide="${target}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [pending, guiding])

  const opButton = (op: Op, cls: string) => {
    const active = pending?.op === op
    return (
      <button
        key={op}
        type="button"
        className={`btn py-1! ${cls}`}
        title={HINTS[op]}
        aria-pressed={MEMORY_OPS.includes(op) ? active : undefined}
        disabled={pending !== null && !active}
        onClick={() => dispatch({ type: 'op', op })}
      >
        {op}
      </button>
    )
  }

  const saveProtocol = () => {
    const blob = new Blob([m.protocol.join('\r\n') + '\r\n'], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'protokoll.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="app-shell view-cpudirect">
      <AppHeader title={info.name} subtitle="GIS Machine" stage={`${info.stage} · ${info.subtitle}`} onGuide={startGuide} />
      <MenuBar
        menus={[
          versionMenu,
          {
            label: 'Ansicht',
            items: [
              { label: 'AC dezimal', checked: acDecimal, onSelect: toggleAcDecimal },
              { label: 'Increment / Decrement', checked: showIncDec, onSelect: toggleIncDec },
              { label: 'Schiebebefehle', checked: showShift, onSelect: toggleShift },
              { label: 'Negation', checked: showNeg, onSelect: toggleNeg },
              { label: 'Logikbefehle', checked: showLogic, onSelect: toggleLogic },
              { label: 'CPU-Bild', checked: showImage, onSelect: toggleShowImage },
              ...skinItems,
            ],
          },
          { label: 'Speicher', items: [{ label: 'löschen', onSelect: () => dispatch({ type: 'clearMemory' }) }] },
          {
            label: 'Hilfe',
            items: [
              { label: 'Guide starten', onSelect: startGuide },
              { label: 'Hilfe', onSelect: () => setDoc(DOCS.hilfe) },
              { label: 'Befehle', onSelect: () => setDoc(DOCS.befehle) },
              { label: 'Fehler melden', onSelect: () => window.open(`${REPO_URL}/issues/new`, '_blank', 'noopener') },
              { label: 'about', onSelect: () => setAbout(true) },
            ],
          },
        ]}
      />

      <main className="app-main flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <section
          className="cpu-panel group-box relative shrink-0 overflow-hidden p-4!"
          style={showImage ? { background: 'var(--panel) url(./cpu.jpg) center / cover no-repeat' } : undefined}
          aria-label="Prozessor"
        >
          <span className="chip-label absolute top-2 right-3">Prozessor</span>
          <div className="cpu-layout">
            <div className="cpu-accumulator flex min-w-0 flex-col gap-2" data-guide="ac">
              <span className="chip-label self-start text-xs">Akkumulator (AC)</span>
              <AcDisplay value={m.ac} decimal={acDecimal} />
              <div className="grid grid-cols-2 gap-2 px-4">
                {showIncDec && (
                  <>
                    {opButton('INC', '')}
                    {opButton('DEC', '')}
                  </>
                )}
                {showShift && (
                  <>
                    {opButton('SHL', '')}
                    {opButton('SHR', '')}
                  </>
                )}
                {showNeg && <div className="col-span-2 grid px-12">{opButton('NEG', '')}</div>}
              </div>
            </div>
            <div className="cpu-commands" data-guide="befehle">
              <div className="flex flex-col gap-2">
                {opButton('LDA', 'op-transfer')}
                {opButton('STA', 'op-transfer')}
              </div>
              <div className="flex flex-col gap-2">
                {opButton('ADD', 'op-arith')}
                {opButton('SUB', 'op-arith')}
                {opButton('MUL', 'op-arith')}
                {opButton('DIV', 'op-arith')}
              </div>
              {showLogic && (
                <div className="flex flex-col gap-2">
                  {opButton('AND', 'op-arith')}
                  {opButton('OR', 'op-arith')}
                  {opButton('XOR', 'op-arith')}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-between gap-4">
            {opButton('INM', 'op-io')}
            {opButton('OUTM', 'op-io')}
          </div>
        </section>

        <div className="workspace-grid">
          <GroupBox title="Eingabe" guide="eingabe" className={`cpud-input-panel ${enteringData ? 'selecting' : ''}`}>
            <div className="flex flex-col gap-2">
              <InputBits value={m.input} onToggle={(bit) => dispatch({ type: 'toggleBit', bit })} />
              <NumberInput value={m.input} onChange={(n) => dispatch({ type: 'setInput', value: n })} />
              <button type="button" className="btn self-end" disabled={!enteringData} onClick={() => dispatch({ type: 'commit' })}>
                in die Zelle schreiben
              </button>
            </div>
          </GroupBox>
          <GroupBox title="Ausgabe" guide="ausgabe" className="cpud-output-panel">
            <OutputLeds value={m.output} />
          </GroupBox>
          <GroupBox title={selectingCell ? 'Speicher – Zelle anklicken' : 'Speicher'} guide="speicher" className={`cpud-memory-panel ${selectingCell ? 'selecting' : ''}`}>
            <div className="memory-viewport">
              <MemoryList memory={m.mem} selectable={selectingCell} last={m.last} onSelect={(addr) => dispatch({ type: 'cell', addr })} />
            </div>
          </GroupBox>
          <GroupBox title="Protokoll" guide="protokoll" className="cpud-protocol-panel">
            <pre
              className="protocol-log sunken overflow-auto p-1 font-mono text-xs"
              aria-label="Protokoll"
              ref={(el) => {
                el?.scrollTo(0, el.scrollHeight)
              }}
            >
              {m.protocol.join('\n')}
            </pre>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <button type="button" className="btn px-2!" aria-pressed={m.recording} disabled={m.recording} onClick={() => dispatch({ type: 'record', on: true })}>
                Protokoll starten
              </button>
              <button type="button" className="btn px-2!" aria-pressed={!m.recording} disabled={!m.recording} onClick={() => dispatch({ type: 'record', on: false })}>
                Protokoll beenden
              </button>
              <label className="flex items-center gap-1 px-1">
                <input type="checkbox" checked={m.withComment} onChange={(e) => dispatch({ type: 'comment', on: e.target.checked })} />
                mit Kommentar
              </label>
              <span className="flex-1" />
              <button type="button" className="btn px-2!" disabled={m.protocol.length === 0} onClick={saveProtocol} title="Protokoll als Textdatei speichern">
                speichern
              </button>
              <button type="button" className="btn px-2!" disabled={m.protocol.length === 0} onClick={() => dispatch({ type: 'clearProtocol' })}>
                löschen
              </button>
            </div>
          </GroupBox>
        </div>
      </main>

      <StatusBar error={m.statusIsError}>
        <span className="min-w-0 flex-[1_1_14rem]">{m.status}</span>
        {pending && (
          <button type="button" className="btn py-0.5!" onClick={() => dispatch({ type: 'cancel' })}>
            Abbrechen (Esc)
          </button>
        )}
        <span className="header-spacer" />
        <span>{storageError ? 'Autosicherung nicht möglich – Programm-Link kopieren oder Datei speichern' : 'Programm lokal gesichert'}</span>
      </StatusBar>

      {guiding && <GuideOverlay steps={GUIDE_STEPS} index={guideIndex ?? 0} onIndex={gotoGuideStep} onClose={closeGuide} />}
      {m.alert && (
        <Dialog title="CPU-Direkt" onClose={() => dispatch({ type: 'dismissAlert' })}>
          <Lines text={m.alert} />
          <button type="button" className="btn self-center px-8!" onClick={() => dispatch({ type: 'dismissAlert' })} autoFocus>
            OK
          </button>
        </Dialog>
      )}
      {doc && (
        <Dialog title={doc.title} onClose={() => setDoc(null)} wide>
          <iframe
            title={doc.title}
            src={doc.src}
            className="sunken doc-frame min-h-0 w-full flex-1 bg-white"
            onLoad={(e) => e.currentTarget.contentWindow?.addEventListener('keydown', (ev) => ev.key === 'Escape' && setDoc(null))}
          />
        </Dialog>
      )}
      {about && (
        <Dialog title="about" onClose={() => setAbout(false)}>
          <p className="mb-2 font-bold">CPU-Direkt – Web-Version (GIS Machine)</p>
          <p className="mb-2">Nachbau des Unterrichtsprogramms CPU-Direkt (J. Schmidt): ein Mikroprozessor mit Akkumulator und 256 Speicherzellen à 16 Bit, direkt per Mausklick gesteuert.</p>
          <p className="mb-2">Stufe 1 des Lernwegs. Der Wechsel zu Altair und MNemo läuft über das Menü „Version“ mit Passwort; das Programm (die 256 Speicherzellen) wird dabei übernommen.</p>
          <p className="mb-2">
            Projekt und Fehlermeldungen:{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-info underline">
              {REPO_URL.replace('https://', '')}
            </a>
          </p>
          <button type="button" className="btn self-center px-8!" onClick={() => setAbout(false)} autoFocus>
            OK
          </button>
        </Dialog>
      )}
    </div>
  )
}

function Lines({ text }: { text: string }): ReactNode {
  return (
    <div className="mb-4">
      {text.split('\n').map((line, i) => (
        <p key={i} className="min-h-4">
          {line}
        </p>
      ))}
    </div>
  )
}

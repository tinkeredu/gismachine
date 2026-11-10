import { useCallback, useEffect, useState } from 'react'
import { assemble, type AssembleResult } from '../../core/mnemo/assembler'
import { decompile } from '../../core/mnemo/decompile'
import { readText, transferMemory, writeText } from '../../core/suite'
import { REPO_URL } from '../../config'
import { useStoredFlag } from '../skin'
import { GUIDE_STEPS, type GuideContext } from '../guides/mnemo'
import type { ViewProps } from '../viewProps'
import { AppHeader, Dialog, GuideOverlay, MenuBar, StatusBar } from '../ui'
import { Editor } from './mnemo/Editor'
import { PauseIcon, PhaseIcon, PlayIcon, StepIcon, StopIcon } from './mnemo/Icons'
import { InputField } from './mnemo/InputField'
import { Accumulator, GroupBox, InstructionRegister, MemoryList, OutputList, Register, StackList } from './mnemo/Panels'
import { useMachine } from './mnemo/useMachine'

const DEFAULT_SOURCE = `; Addition zweier Zahlen
\tinm zahl1\t; erste Zahl einlesen
\tinm zahl2\t; zweite Zahl einlesen
\tlda zahl1
\tadd zahl2
\tsta summe
\toutm summe\t; Ergebnis ausgeben
\tstop

zahl1\tdef 0
zahl2\tdef 0
summe\tdef 0
`

const SOURCE_KEY = 'gismachine.mnemo.source'
const NAME_KEY = 'gismachine.mnemo.filename'
const BACKUP_KEY = 'gismachine.mnemo.sourceBackup'
const DOC = { title: 'Befehlssatz', src: './docs/mnemo-befehlssatz.htm' }
const PHASE_LABEL = { fetch: 'Holphase', decode: 'Dekodierphase', execute: 'Ausführungsphase' } as const

const sameMemory = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((w, i) => w === b[i])

interface Boot {
  memory: number[]
  source: string
  fileName: string
  lineOfAddress: (number | null)[]
  /** true, wenn der Quelltext aus dem übernommenen Speicher erzeugt wurde. */
  generated: boolean
}

/**
 * Startzustand: Passt der gespeicherte Quelltext zum übernommenen Speicher, bleibt er.
 * Sonst wird der Speicher in einen Quelltext zurückübersetzt (der alte Quelltext kommt in die Sicherung).
 */
function bootState(memory: readonly number[]): Boot {
  const mem = transferMemory(memory)
  const stored = readText(SOURCE_KEY) ?? DEFAULT_SOURCE
  const fileName = readText(NAME_KEY) ?? 'programm.mno'
  const compiled = assemble(stored)
  if (compiled.ok && sameMemory(compiled.memory, mem)) return { memory: mem, source: stored, fileName, lineOfAddress: compiled.lineOfAddress, generated: false }
  const source = decompile(mem)
  if (source === null) return { memory: mem, source: stored, fileName, lineOfAddress: [], generated: false }
  if (stored !== DEFAULT_SOURCE) writeText(BACKUP_KEY, stored)
  const full = `; Aus dem Speicher übernommen und automatisch zurückübersetzt.\n; Variablen heißen z<Adresse>, Sprungmarken m<Adresse> – gerne umbenennen.\n${source}`
  const result = assemble(full)
  return { memory: mem, source: full, fileName: 'uebernommen.mno', lineOfAddress: result.ok ? result.lineOfAddress : [], generated: true }
}

export function MnemoView({ memory, onMemoryChange, info, versionMenu, skinItems, storageError }: ViewProps) {
  const [boot] = useState(() => bootState(memory))
  const m = useMachine(boot.memory)
  const { cpu } = m
  const [source, setSource] = useState(boot.source)
  const [fileName, setFileName] = useState(boot.fileName)
  const [lineOfAddress, setLineOfAddress] = useState<(number | null)[]>(boot.lineOfAddress)
  const [result, setResult] = useState<AssembleResult | null>(null)
  const [followPc, setFollowPc] = useState(true)
  const [jumpText, setJumpText] = useState('')
  const [jump, setJump] = useState<{ addr: number; seq: number } | null>(null)
  const [guideIndex, setGuideIndex] = useState<number | null>(null)
  const [beforeGuide, setBeforeGuide] = useState<{ source: string; fileName: string; memory: number[]; lineOfAddress: (number | null)[] } | null>(null)
  const [showEditor, setShowEditor] = useState(true)
  const [showStack, toggleStack] = useStoredFlag('gismachine.mnemo.stack')
  const [showControlUnit, toggleControlUnit] = useStoredFlag('gismachine.mnemo.controlUnit')
  const [showArDr, toggleArDr] = useStoredFlag('gismachine.mnemo.arDr')
  const [backup, setBackup] = useState(() => readText(BACKUP_KEY))
  const [notice, setNotice] = useState<string | null>(boot.generated ? 'Das übernommene Programm wurde in einen MNemo-Quelltext zurückübersetzt.' : null)
  const [doc, setDoc] = useState(false)
  const [about, setAbout] = useState(false)
  const guiding = guideIndex !== null

  useEffect(() => {
    if (!guiding) writeText(SOURCE_KEY, source)
  }, [source, guiding])
  useEffect(() => {
    if (!guiding) writeText(NAME_KEY, fileName)
  }, [fileName, guiding])

  // Das Programm (256 Speicherzellen) geht an die Shell – außer während des Guides.
  useEffect(() => {
    if (!guiding) onMemoryChange(cpu.mem)
  })

  const { reset } = m
  const compile = useCallback(
    (src: string) => {
      const r = assemble(src)
      setResult(r)
      if (!r.ok) return
      setLineOfAddress(r.lineOfAddress)
      reset(r.memory)
    },
    [reset],
  )

  const jumpTo = (text: string) => {
    const addr = Number(text)
    if (!/^\d+$/.test(text.trim()) || addr > 255) return
    setFollowPc(false)
    setJump((j) => ({ addr, seq: (j?.seq ?? 0) + 1 }))
  }

  const guideContext: GuideContext = {
    load: (src) => {
      setSource(src)
      setFileName('guide.mno')
      compile(src)
    },
    microStep: m.microStep,
    step: m.step,
    provideInput: m.provideInput,
  }

  const gotoGuideStep = (index: number) => {
    setShowEditor(true)
    setFollowPc(true)
    GUIDE_STEPS.slice(0, index + 1).forEach((s) => s.apply?.(guideContext))
    setGuideIndex(index)
  }

  const startGuide = () => {
    if (guiding) return
    setBeforeGuide({ source, fileName, memory: cpu.mem.slice(), lineOfAddress })
    m.pause()
    gotoGuideStep(0)
  }

  const closeGuide = () => {
    setGuideIndex(null)
    if (!beforeGuide) return
    setSource(beforeGuide.source)
    setFileName(beforeGuide.fileName)
    setLineOfAddress(beforeGuide.lineOfAddress)
    setResult(null)
    m.reset(beforeGuide.memory)
    setBeforeGuide(null)
  }

  const restoreBackup = () => {
    if (backup === null) return
    const current = source
    setSource(backup)
    setFileName('programm.mno')
    setResult(null)
    writeText(BACKUP_KEY, current)
    setBackup(current)
    setNotice('Vorheriger Quelltext wiederhergestellt. Mit „Übersetzen“ kommt er in den Speicher.')
  }

  const halted = cpu.state === 'halted' || cpu.state === 'error'
  const currentLine = lineOfAddress[cpu.phase === 'fetch' ? cpu.pc : (cpu.pc + 255) % 256] ?? null
  const status =
    cpu.state === 'input'
      ? 'Warte auf Eingabe …'
      : cpu.state === 'halted'
        ? 'Programm beendet (stop).'
        : cpu.state === 'error'
          ? `Fehler: ${cpu.error}`
          : m.running
            ? 'Programm läuft …'
            : `Bereit – nächste Phase: ${PHASE_LABEL[cpu.phase]}`

  return (
    <div className="app-shell view-mnemo">
      <AppHeader title={info.name} subtitle="GIS Machine" stage={`${info.stage} · ${info.subtitle}`} onGuide={startGuide} />
      <MenuBar
        menus={[
          versionMenu,
          {
            label: 'Quelltext',
            items: [
              { label: 'Editor anzeigen', checked: showEditor, onSelect: () => setShowEditor((s) => !s) },
              ...(backup !== null ? [{ label: 'Vorherigen Quelltext wiederherstellen', separator: true, onSelect: restoreBackup }] : []),
            ],
          },
          {
            label: 'Ansicht',
            items: [
              { label: 'Stack', checked: showStack, onSelect: toggleStack },
              { label: 'Steuerwerk (PC, IR)', checked: showControlUnit, onSelect: toggleControlUnit },
              { label: 'AR/DR-Register', checked: showArDr, onSelect: toggleArDr },
              ...skinItems,
            ],
          },
          {
            label: 'Hilfe',
            items: [
              { label: 'Guide starten', onSelect: startGuide },
              { label: 'Befehlssatz', onSelect: () => setDoc(true) },
              { label: 'Fehler melden', onSelect: () => window.open(`${REPO_URL}/issues/new`, '_blank', 'noopener') },
              { label: 'about', onSelect: () => setAbout(true) },
            ],
          },
        ]}
      />

      <main className="app-main flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 lg:flex-row">
        <div className="grid min-h-0 shrink-0 gap-3 lg:h-full lg:w-[min(760px,60%)]" style={{ gridTemplateRows: 'minmax(0,1fr) auto' }}>
          <div className={`grid min-h-[360px] gap-3 ${showStack && !guiding ? 'grid-cols-[170px_1fr_170px]' : 'grid-cols-[170px_1fr]'}`}>
            <div className="flex flex-col gap-3">
              <GroupBox title="Rechenwerk" guide="rechenwerk">
                <Accumulator value={cpu.ac} />
              </GroupBox>
              {showControlUnit && !guiding && (
                <GroupBox title="Steuerwerk" className="flex-1" guide="steuerwerk">
                  <div className="flex flex-col gap-2">
                    <Register label="PC (Program Counter)" value={String(cpu.pc).padStart(3, '0')} />
                    <InstructionRegister value={cpu.ir} />
                    <p className="text-xs text-muted">{cpu.state === 'input' ? 'wartet auf Eingabe' : `${PHASE_LABEL[cpu.phase]} als Nächstes`}</p>
                  </div>
                </GroupBox>
              )}
            </div>
            <GroupBox title="Speicherwerk" className="flex min-h-0 flex-col">
              {showArDr && !guiding && (
                <div className="mb-2 flex gap-2">
                  <Register label="AR (Address-Register)" value={String(cpu.ar).padStart(3, '0')} />
                  <Register label="DR (Data-Register)" value={formatDr(cpu.dr)} />
                </div>
              )}
              <form
                className="mb-2 flex flex-wrap items-center gap-1 text-xs"
                onSubmit={(e) => {
                  e.preventDefault()
                  jumpTo(jumpText)
                }}
              >
                <label className="flex items-center gap-1">
                  Gehe zu
                  <input aria-label="Gehe zu Adresse" value={jumpText} onChange={(e) => setJumpText(e.target.value)} inputMode="numeric" placeholder="000" className="sunken w-14 px-1 font-mono" />
                </label>
                <button type="submit" className="btn px-2! py-0!">
                  OK
                </button>
                <label className="ml-auto flex items-center gap-1">
                  <input type="checkbox" checked={followPc} onChange={(e) => setFollowPc(e.target.checked)} />
                  PC folgen
                </label>
              </form>
              <div className="h-[50vh] min-h-64 lg:h-auto lg:min-h-0 lg:flex-1" data-guide="memory">
                <MemoryList memory={cpu.mem} pc={cpu.pc} ar={cpu.ar} followPc={followPc} jump={jump} />
              </div>
            </GroupBox>
            {showStack && !guiding && (
              <GroupBox title="Stack" className="flex min-h-0 flex-col" guide="stack">
                <div className="mb-2 flex gap-2">
                  <Register label="SP" value={String(cpu.sp).padStart(3, '0')} />
                  <Register label="BP" value={String(cpu.bp).padStart(3, '0')} />
                </div>
                <div className="h-[50vh] min-h-48 lg:h-auto lg:min-h-0 lg:flex-1">
                  <StackList memory={cpu.mem} sp={cpu.sp} bp={cpu.bp} />
                </div>
              </GroupBox>
            )}
          </div>

          <div className="grid grid-cols-[170px_1fr_1fr] gap-3">
            <GroupBox title="Steuerung" guide="steuerung">
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  <button type="button" className="btn px-2! py-1.5!" title="Einzelschritt (ein Befehl)" aria-label="Einzelschritt" onClick={m.step} disabled={m.running || cpu.state !== 'ready'}>
                    <StepIcon />
                  </button>
                  <button type="button" className="btn px-2! py-1.5!" title="Eine Phase (Holen/Dekodieren/Ausführen)" aria-label="Phase" onClick={m.microStep} disabled={m.running || cpu.state !== 'ready'}>
                    <PhaseIcon />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="btn px-2! py-1.5! text-ok" title="Start" aria-label="Start" onClick={m.run} disabled={m.running || halted}>
                    <PlayIcon />
                  </button>
                  <button type="button" className="btn px-2! py-1.5!" title="Pause" aria-label="Pause" onClick={m.pause} disabled={!m.running}>
                    <PauseIcon />
                  </button>
                  <button type="button" className="btn px-2! py-1.5! text-err" title="Zurücksetzen" aria-label="Zurücksetzen" onClick={() => m.reset()}>
                    <StopIcon />
                  </button>
                </div>
                <label className="w-full text-xs">
                  Pause nach jedem Befehl
                  <input type="range" min={0} max={1000} step={50} value={m.delay} onChange={(e) => m.setDelay(Number(e.target.value))} className="w-full" aria-label="Pause nach jedem Befehl" />
                  <span className="flex justify-between">
                    <span>klein</span>
                    <span>{m.delay} ms</span>
                    <span>groß</span>
                  </span>
                </label>
              </div>
            </GroupBox>
            <GroupBox title="Eingabe" guide="eingabe" className="flex flex-col">
              <div className="flex flex-1 flex-col gap-3">
                <InputField active={cpu.state === 'input'} onSubmit={m.provideInput} />
                <button type="button" className="btn mt-auto self-center px-8!" onClick={() => setShowEditor((s) => !s)} aria-pressed={showEditor}>
                  Editor
                </button>
              </div>
            </GroupBox>
            <GroupBox title="Ausgabe" className="flex flex-col" guide="ausgabe">
              <div className="h-32">
                <OutputList values={cpu.output} />
              </div>
            </GroupBox>
          </div>
        </div>

        {showEditor && (
          <GroupBox title={`Editor – ${fileName}`} className="flex min-h-[480px] min-w-0 flex-1 flex-col lg:min-h-0" guide="editor">
            <Editor
              source={source}
              onChange={setSource}
              result={result}
              onCompile={() => compile(source)}
              onClearResult={() => setResult(null)}
              currentLine={currentLine}
              fileName={fileName}
              onFileNameChange={setFileName}
            />
          </GroupBox>
        )}
      </main>

      <StatusBar error={cpu.state === 'error'}>
        <span className={`status-dot ${m.running ? 'running' : ''}`} />
        <span role="status">{status}</span>
        <span className="header-spacer" />
        <span>{storageError ? 'Autosicherung nicht möglich – Programm-Link kopieren oder Datei speichern' : 'Programm lokal gesichert'}</span>
      </StatusBar>

      {notice && (
        <div className="notice view-notice" role="status">
          <span>{notice}</span>
          <button className="btn" aria-label="Meldung schließen" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {guiding && <GuideOverlay steps={GUIDE_STEPS} index={guideIndex} onIndex={gotoGuideStep} onClose={closeGuide} />}
      {m.alert && (
        <Dialog title="MNemo" onClose={m.dismissAlert}>
          <p className="mb-4">{m.alert}</p>
          <button type="button" className="btn self-center px-8!" onClick={m.dismissAlert} autoFocus>
            OK
          </button>
        </Dialog>
      )}
      {doc && (
        <Dialog title={DOC.title} onClose={() => setDoc(false)} wide>
          <iframe
            title={DOC.title}
            src={DOC.src}
            className="sunken doc-frame min-h-0 w-full flex-1 bg-white"
            onLoad={(e) => e.currentTarget.contentWindow?.addEventListener('keydown', (ev) => ev.key === 'Escape' && setDoc(false))}
          />
        </Dialog>
      )}
      {about && (
        <Dialog title="about" onClose={() => setAbout(false)}>
          <p className="mb-2 font-bold">MNemo – Web-Version (GIS Machine)</p>
          <p className="mb-2">Nachbau des Unterrichtsprogramms MNemo 3.2: 256 Speicherzellen à 16 Bit, Akkumulator, Stack und 56 Befehle mit Assembler.</p>
          <p className="mb-2">Stufe 3 des Lernwegs CPU-Direkt → Altair → MNemo. Der Wechsel läuft über das Menü „Version“ mit Passwort; das Programm (die 256 Speicherzellen) wird übernommen.</p>
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

function formatDr(word: number) {
  return word < 0x8000 ? String(word) : `${word} (${word - 0x10000})`
}

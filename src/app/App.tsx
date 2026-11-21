import { useCallback, useEffect, useRef, useState } from 'react'
import { SWITCH_PASSWORD } from '../config'
import { MEMORY_SIZE, VERSIONS, VERSION_INFO, buildHash, canTransferProgram, checkPassword, memoryForSwitch, parseHash, readSession, sanitizeMemory, transferMemory, versionIndex, writeSession, type MnemoDocument, type VersionId } from '../core/suite'
import type { MnemoStartMode } from '../core/mnemo/program'
import { AltairView } from './versions/AltairView'
import { CpudirectView } from './versions/CpudirectView'
import { MnemoView } from './versions/MnemoView'
import type { ViewProps } from './viewProps'
import { Dialog } from './ui'
import type { MenuSpec } from './ui'
import { SKINS, useSkin } from './skin'

interface BootState {
  version: VersionId
  memory: number[]
  mode: MnemoStartMode
  document?: MnemoDocument
}

/** Älterer Kopierweg für Browser ohne Clipboard-API (z. B. unverschlüsselte Schulserver). */
function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

/** Startzustand: Direktlink (`#version` / `#version!programm`) hat Vorrang, sonst der gespeicherte Stand. */
function bootState(): BootState {
  const hash = parseHash(window.location.hash)
  const session = readSession()
  const version = hash.version ?? session.version ?? 'cpudirect'
  const resume = version === session.version
  const memory = hash.memory ?? (resume ? session.memory : null) ?? new Array(MEMORY_SIZE).fill(0)
  return { version, memory: transferMemory(memory), mode: hash.memory ? 'import' : resume ? 'resume' : 'empty', document: hash.document }
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4000)
    return () => window.clearTimeout(timer)
  }, [text, onClose])
  return (
    <div className="notice" role="status">
      <span>{text}</span>
      <button type="button" className="btn" aria-label="Meldung schließen" onClick={onClose}>
        ×
      </button>
    </div>
  )
}

export default function App() {
  const [boot] = useState(bootState)
  const [active, setActive] = useState(boot)
  const { version } = active
  const memoryRef = useRef<number[]>(boot.memory)
  const versionRef = useRef<VersionId>(boot.version)
  const mnemoDocumentRef = useRef<MnemoDocument | null>(null)
  const [skin, setSkin] = useSkin()
  const [passwordTarget, setPasswordTarget] = useState<VersionId | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [keepProgram, setKeepProgram] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState(false)
  const persistTimer = useRef<number | null>(null)

  const persist = useCallback(() => {
    setStorageError(!writeSession(versionRef.current, memoryRef.current))
  }, [])

  const schedulePersist = useCallback(() => {
    if (persistTimer.current !== null) return
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null
      persist()
    }, 500)
  }, [persist])

  // Speichern auch beim Verlassen der Seite.
  useEffect(() => {
    const flush = () => {
      if (persistTimer.current !== null) {
        window.clearTimeout(persistTimer.current)
        persistTimer.current = null
      }
      persist()
    }
    window.addEventListener('beforeunload', flush)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [persist])

  // Versionswechsel sofort speichern.
  useEffect(() => {
    versionRef.current = version
    persist()
  }, [version, persist])

  /** Die aktive Ansicht meldet ihren Speicher (256 Wörter) an die Shell. */
  const handleMemoryChange = useCallback(
    (memory: number[]) => {
      const clean = sanitizeMemory(memory)
      if (!clean) return
      memoryRef.current = clean
      schedulePersist()
    },
    [schedulePersist],
  )

  const requestSwitch = useCallback((target: VersionId) => {
    if (target === versionRef.current) return
    setPasswordInput('')
    setPasswordError(false)
    setKeepProgram(true)
    setPasswordTarget(target)
  }, [])

  const handleMnemoDocumentChange = useCallback((document: MnemoDocument) => {
    mnemoDocumentRef.current = document
  }, [])

  const copyProgramLink = useCallback(() => {
    const hash = buildHash(versionRef.current, memoryRef.current, mnemoDocumentRef.current)
    const url = `${window.location.origin}${window.location.pathname}${hash}`
    const done = () => setNotice('Programm-Link kopiert. Er öffnet die App direkt in dieser Version mit dem aktuellen Programm.')
    const fail = () => setNotice(url)
    const fallback = () => (legacyCopy(url) ? done() : fail())
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, fallback)
    } else {
      fallback()
    }
  }, [])

  const submitPassword = useCallback(() => {
    if (passwordTarget === null) return
    if (!checkPassword(passwordInput, SWITCH_PASSWORD)) {
      setPasswordError(true)
      return
    }
    const target = passwordTarget
    const from = versionRef.current
    const transferring = keepProgram && canTransferProgram(from, target)
    const memory = memoryForSwitch(from, target, keepProgram, memoryRef.current)
    setPasswordTarget(null)
    setPasswordInput('')
    setPasswordError(false)
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
    versionRef.current = target
    memoryRef.current = memory
    setActive({ version: target, memory, mode: transferring ? 'import' : 'empty' })
    setNotice(
      transferring
        ? `${VERSION_INFO[target].name}: Programm übernommen. Der Prozessor startet neu.`
        : `${VERSION_INFO[target].name}: Ohne Programm gestartet.`,
    )
  }, [passwordTarget, passwordInput, keepProgram])

  const versionMenu: MenuSpec = {
    label: 'Version',
    items: [
      ...VERSIONS.map((id) => ({
        label: `${versionIndex(id) + 1} · ${VERSION_INFO[id].name}`,
        checked: id === version,
        onSelect: () => requestSwitch(id),
      })),
      { label: 'Programm-Link kopieren', separator: true, onSelect: copyProgramLink },
    ],
  }

  const viewProps: ViewProps = {
    memory: active.memory,
    onMemoryChange: handleMemoryChange,
    info: VERSION_INFO[version],
    versionMenu,
    skinItems: SKINS.map((s, i) => ({ label: s.label, checked: skin === s.id, separator: i === 0, onSelect: () => setSkin(s.id) })),
    storageError,
  }

  return (
    <>
      {version === 'cpudirect' && <CpudirectView key="cpudirect" {...viewProps} />}
      {version === 'altair' && <AltairView key="altair" {...viewProps} />}
      {version === 'mnemo' && (
        <MnemoView key="mnemo" {...viewProps} mode={active.mode} linkedDocument={active.document} onDocumentChange={handleMnemoDocumentChange} />
      )}

      {passwordTarget !== null && (
        <Dialog title="Versionswechsel" onClose={() => setPasswordTarget(null)}>
          <p>
            Wechsel von <strong>{VERSION_INFO[version].name}</strong> zu <strong>{VERSION_INFO[passwordTarget].name}</strong>.
          </p>
          <p className="text-muted">Register und CPU-Zustand starten neu.</p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitPassword()
            }}
          >
            {canTransferProgram(version, passwordTarget) ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={keepProgram} onChange={(e) => setKeepProgram(e.target.checked)} />
                Aktuelles Programm übernehmen
              </label>
            ) : (
              <p className="text-muted">Bei einem Wechsel von oder zu CPU-Direkt wird kein Programm übernommen.</p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Passwort
              <input
                type="password"
                value={passwordInput}
                autoFocus
                autoComplete="off"
                aria-invalid={passwordError}
                onChange={(e) => {
                  setPasswordInput(e.target.value)
                  setPasswordError(false)
                }}
                className="sunken px-2 py-1 font-mono"
              />
            </label>
            {passwordError && (
              <p className="text-sm font-bold text-err" role="alert">
                Falsches Passwort. Bitte erneut versuchen.
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setPasswordTarget(null)}>
                Abbrechen
              </button>
              <button type="submit" className="btn primary">
                Wechseln
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
    </>
  )
}

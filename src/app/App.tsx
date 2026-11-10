import { useCallback, useEffect, useRef, useState } from 'react'
import { SWITCH_PASSWORD } from '../config'
import { MEMORY_SIZE, VERSIONS, VERSION_INFO, buildHash, checkPassword, parseHash, readSession, sanitizeMemory, switchDirection, transferMemory, versionIndex, writeSession, type VersionId } from '../core/suite'
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
  const memory = hash.memory ?? session.memory ?? new Array(MEMORY_SIZE).fill(0)
  return { version, memory: transferMemory(memory) }
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
  // Speicher, der der jeweils aktiven Ansicht beim Mount übergeben wird (wird nur beim Versionswechsel neu gesetzt).
  const [activeMemory, setActiveMemory] = useState(boot.memory)
  const [version, setVersion] = useState<VersionId>(boot.version)
  const memoryRef = useRef<number[]>(boot.memory)
  const versionRef = useRef<VersionId>(boot.version)
  const [skin, setSkin] = useSkin()
  const [passwordTarget, setPasswordTarget] = useState<VersionId | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
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
    setPasswordTarget(target)
  }, [])

  const copyProgramLink = useCallback(() => {
    const hash = buildHash(versionRef.current, memoryRef.current)
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
    const direction = switchDirection(versionRef.current, target)
    setPasswordTarget(null)
    setPasswordInput('')
    setPasswordError(false)
    versionRef.current = target
    setActiveMemory(memoryRef.current.slice())
    setVersion(target)
    setNotice(
      direction === 'backward'
        ? `Zurück zu ${VERSION_INFO[target].name}: Das Programm wurde übernommen, der Prozessor startet neu.`
        : `Weiter zu ${VERSION_INFO[target].name}: Das Programm wurde übernommen, der Prozessor startet neu.`,
    )
  }, [passwordTarget, passwordInput])

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
    memory: activeMemory,
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
      {version === 'mnemo' && <MnemoView key="mnemo" {...viewProps} />}

      {passwordTarget !== null && (
        <Dialog title="Versionswechsel" onClose={() => setPasswordTarget(null)}>
          <p>
            Wechsel von <strong>{VERSION_INFO[version].name}</strong> zu <strong>{VERSION_INFO[passwordTarget].name}</strong>.
          </p>
          <p className="text-muted">Das aktuelle Programm (256 Speicherzellen) wird übernommen. Register und CPU-Zustand starten neu, wie nach einem Reset.</p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitPassword()
            }}
          >
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

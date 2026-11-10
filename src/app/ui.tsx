import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { guidePosition, type Rect } from './guideLayout'

/* ---------- Menübalken ---------- */

export interface MenuItem {
  label: string
  onSelect: () => void
  checked?: boolean
  separator?: boolean
}

export interface MenuSpec {
  label: string
  items: MenuItem[]
}

export function MenuBar({ menus }: { menus: MenuSpec[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const ref = useRef<HTMLElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])
  return (
    <nav
      ref={ref}
      data-guide="menu"
      className="menubar relative flex select-none"
      role="menubar"
      aria-label="Hauptmenü"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open !== null) {
          e.preventDefault()
          buttons.current[open]?.focus()
          setOpen(null)
        }
      }}
    >
      {menus.map((m, i) => (
        <div key={m.label} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            className={`px-2 py-0.5 ${open === i ? 'bg-sel text-sel-fg' : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => open !== null && setOpen(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                setOpen(i)
                requestAnimationFrame(() => {
                  const items = ref.current?.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]')
                  items?.[e.key === 'ArrowUp' ? items.length - 1 : 0]?.focus()
                })
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const next = (i + (e.key === 'ArrowLeft' ? -1 : 1) + menus.length) % menus.length
                if (open !== null) setOpen(next)
                buttons.current[next]?.focus()
              }
            }}
          >
            {m.label}
          </button>
          {open === i && (
            <div
              role="menu"
              className="absolute top-full left-0 z-40 min-w-44 menu-pop py-0.5"
              onKeyDown={(e) => {
                const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
                const current = items.indexOf(document.activeElement as HTMLButtonElement)
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? items.length - 1
                      : e.key === 'ArrowDown'
                        ? (current + 1) % items.length
                        : e.key === 'ArrowUp'
                          ? (current - 1 + items.length) % items.length
                          : null
                if (next !== null) {
                  e.preventDefault()
                  items[next]?.focus()
                }
                if (e.key === 'Tab') setOpen(null)
              }}
            >
              {m.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`flex w-full gap-2 px-2 py-0.5 text-left hover:bg-sel hover:text-sel-fg ${item.separator ? 'mt-0.5 border-t border-line pt-1' : ''}`}
                  onClick={() => {
                    setOpen(null)
                    item.onSelect()
                    buttons.current[i]?.focus()
                  }}
                >
                  <span className="w-3">{item.checked ? '✓' : ''}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}

/* ---------- Dialog ---------- */

export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current!
    el.showModal()
    return () => {
      el.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`native-dialog ${wide ? 'wide' : ''}`}
    >
      <div className="dialog-title">
        <h2>{title}</h2>
        <button className="btn" aria-label="Schließen" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  )
}

/* ---------- Kopfzeile und Statusleiste ---------- */

export function AppHeader({ title, subtitle, stage, onGuide }: { title: string; subtitle: string; stage: string; onGuide: () => void }) {
  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        M<span>16</span>
      </div>
      <div>
        <h1>{title}</h1>
        <p>
          {subtitle} · <strong>{stage}</strong>
        </p>
      </div>
      <span className="header-spacer" />
      <button type="button" className="btn" onClick={onGuide}>
        Guide starten
      </button>
    </header>
  )
}

export function StatusBar({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <footer className={`statusbar ${error ? 'error' : ''}`}>
      {children}
    </footer>
  )
}

/* ---------- Guide (Spotlight-Overlay) ---------- */

export interface GuideStep {
  title: string
  /** `data-guide`-Wert des Elements, das hervorgehoben wird. */
  target?: string
  body: ReactNode
}

const PAD = 6
const CARD_W = 380

export function GuideOverlay({ steps, index, onIndex, onClose }: { steps: GuideStep[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const step = steps[index]
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [cardHeight, setCardHeight] = useState(300)
  const cardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const observer = new ResizeObserver(() => setCardHeight(card.getBoundingClientRect().height))
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`) : null
    el?.scrollIntoView({ block: 'start', inline: 'nearest' })
    let frame = 0
    const measure = () => {
      const r = el?.getBoundingClientRect()
      setRect((prev) => {
        if (!r) return null
        if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      })
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < steps.length - 1) onIndex(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, steps.length, onIndex, onClose])

  const width = Math.min(CARD_W, viewport.width - 16)
  const cardStyle = { width, ...guidePosition(rect, viewport, { width, height: cardHeight }) }

  const last = index === steps.length - 1
  return (
    <div className="fixed inset-0 z-50" aria-live="polite">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded border-2 border-yellow-400 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/45" />
      )}
      <div ref={cardRef} role="dialog" aria-modal="true" aria-label={`Guide: ${step.title}`} className="fixed guide-card p-3" style={cardStyle}>
        <div className="mb-1 flex items-baseline gap-2">
          <h2 className="flex-1 font-bold">{step.title}</h2>
          <span className="shrink-0 text-xs text-muted">
            {index + 1} / {steps.length}
          </span>
        </div>
        <div className="flex flex-col gap-2 text-[13px]">{step.body}</div>
        <div className="mt-3 flex flex-wrap gap-1">
          <button type="button" className="btn" onClick={onClose}>
            Beenden
          </button>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={() => onIndex(index - 1)} disabled={index === 0}>
            Zurück
          </button>
          <button type="button" className="btn font-bold" onClick={() => (last ? onClose() : onIndex(index + 1))} autoFocus>
            {last ? 'Fertig' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { readStored, writeStored } from '../core/suite'

export type Skin = 'auto' | 'light' | 'dark' | 'classic' | 'terminal'

export const SKINS: { id: Skin; label: string }[] = [
  { id: 'auto', label: 'Automatisch (System)' },
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'classic', label: 'Klassisch (Windows)' },
  { id: 'terminal', label: 'Terminal' },
]

const SKIN_KEY = 'gismachine.skin'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function isSkin(value: unknown): value is Skin {
  return typeof value === 'string' && SKINS.some((s) => s.id === value)
}

/** Gemeinsamer Skin für alle drei Versionen; 'auto' folgt dem System. */
export function useSkin(): [Skin, (skin: Skin) => void] {
  const [skin, setSkin] = useState<Skin>(() => readStored(SKIN_KEY, 'auto' as Skin, isSkin))
  const [systemDark, setSystemDark] = useState(darkQuery.matches)
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    writeStored(SKIN_KEY, skin)
    document.documentElement.dataset.skin = skin === 'auto' ? (systemDark ? 'dark' : 'light') : skin
  }, [skin, systemDark])
  return [skin, setSkin]
}

/** Getrenntes Flag in localStorage (für Ansichtsoptionen der Versionen). */
export function useStoredFlag(key: string, initial = false): [boolean, () => void] {
  const [value, setValue] = useState(() => readStored(key, initial, (v): v is boolean => typeof v === 'boolean'))
  useEffect(() => {
    writeStored(key, value)
  }, [key, value])
  return [value, () => setValue((v) => !v)]
}

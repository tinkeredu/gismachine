import type { VersionInfo } from '../core/suite'
import type { MenuItem, MenuSpec } from './ui'

/** Props, die die Shell an jede Versions-Ansicht übergibt. */
export interface ViewProps {
  /** Aktuelles Programm: 256 Speicherwörter à 16 Bit (wird nur beim Mount gelesen). */
  memory: number[]
  /** Meldet den aktuellen Speicherinhalt an die Shell (für Transfer und Autospeicherung). */
  onMemoryChange: (memory: number[]) => void
  /** Version dieser Ansicht (für Kopfzeile und about-Dialoge). */
  info: VersionInfo
  /** Das „Version“-Menü der Shell (Wechsel + Programm-Link). */
  versionMenu: MenuSpec
  /** Einträge für das Hautmenü „Ansicht“ (Skins). */
  skinItems: MenuItem[]
  /** true, wenn der Browser den Programmstand nicht speichern konnte. */
  storageError: boolean
}

import type { ReactNode } from 'react'
import { run, type Machine } from '../../core/cpudirect/machine'

export interface GuideStep {
  title: string
  /** `data-guide`-Wert des Elements, das hervorgehoben wird. */
  target?: string
  body: ReactNode
  /** Wird beim Betreten des Schritts angewendet; alle vorherigen Schritte werden vorher abgespielt. */
  apply?: (m: Machine) => Machine
}

const k = (s: string) => <code className="rounded bg-code px-1 font-mono">{s}</code>

const PATH_STEP: GuideStep = {
  title: 'Der Weg durch die Versionen',
  body: (
    <>
      <p>Diese App führt in drei Stufen zum Programmieren eines Modellrechners: <b>1 CPU-Direkt</b> → <b>2 Altair</b> → <b>3 MNemo</b>.</p>
      <p>
        Du bist hier bei <b>CPU-Direkt</b>: Der Anfang. Die CPU wird von Hand bedient, jeder Befehl ist ein Klick. Danach folgen Altair (Befehle als 16-Bit-Wörter über Schalter) und MNemo (ein Assembler mit 56 Befehlen).
      </p>
      <p>
        Beim Wechsel bleibt immer <b>dasselbe Programm</b> erhalten: die 256 Speicherzellen. Register und CPU-Zustand starten neu. Der Wechsel selbst ist passwortgeschützt (Menü „Version“).
      </p>
    </>
  ),
}

export const GUIDE_STEPS: GuideStep[] = [
  PATH_STEP,
  {
    title: 'Willkommen bei CPU-Direkt',
    body: (
      <>
        <p>CPU-Direkt simuliert einen stark vereinfachten Mikroprozessor (CPU) mit einem Speicher aus 256 Zellen à 16 Bit.</p>
        <p>Die Maschine ist <b>nicht programmierbar</b>: Jeder Befehl wird durch einen Klick auf seine Schaltfläche sofort ausgeführt – ähnlich wie bei einem sehr einfachen Taschenrechner.</p>
        <p>Der Guide rechnet als Beispiel {k('5 + 3')}.</p>
      </>
    ),
  },
  {
    title: 'Der Akkumulator',
    target: 'ac',
    body: (
      <>
        <p>Der <b>Akkumulator (AC)</b> ist die universelle Speicherzelle im Prozessor. Alle Rechenergebnisse landen hier.</p>
        <p>{k('INC')} und {k('DEC')} erhöhen bzw. vermindern den AC direkt um 1 – ohne Speicherzelle.</p>
      </>
    ),
  },
  {
    title: 'Befehle mit Speicherzelle',
    target: 'befehle',
    body: (
      <>
        <p>Diese Befehle arbeiten mit einer Zelle des Speichers: {k('LDA')}/{k('STA')} kopieren zwischen Speicher und AC, {k('ADD')}, {k('SUB')}, {k('MUL')} und {k('DIV')} verknüpfen den AC mit einer Zelle.</p>
        <p>Nach dem Klick auf den Befehl muss die gewünschte Zelle im Speicher angeklickt werden. Mit [Esc] oder „Abbrechen“ bricht man ab.</p>
      </>
    ),
  },
  {
    title: 'Der Speicher',
    target: 'speicher',
    body: (
      <>
        <p>Jede Zeile ist eine Speicherzelle: links die <b>Adresse</b> (0 … 255), rechts der <b>Inhalt</b> als 16-Bit-Dualzahl.</p>
        <p>Wartet ein Befehl auf eine Zelle, wird der Speicher rot umrandet und die Zeilen sind anklickbar.</p>
        <p>Genau dieser Speicher kommt beim Wechsel zu Altair und MNemo mit – nur die Bedienung wird abstrakter.</p>
      </>
    ),
  },
  {
    title: 'Erste Zahl eingeben: INM 8',
    target: 'eingabe',
    body: (
      <>
        <p>Die Eingabe erfolgt entweder binär über die 16 Kästchen (Haken = 1) oder direkt als Zahl im Zahlenfeld (auch negativ, 0x… oder 0b…).</p>
        <p>Ablauf: {k('INM')} anklicken → Zelle 8 anklicken → 5 eingeben und übernehmen → „in die Zelle schreiben“.</p>
        <p>Der Guide hat das gerade für dich erledigt: Zelle 8 enthält jetzt 5.</p>
      </>
    ),
    apply: (m) => run(m, 'INM', 8, 5),
  },
  {
    title: 'Zweite Zahl: INM 9',
    target: 'speicher',
    body: <p>Genauso wurde die 3 in Zelle 9 gespeichert.</p>,
    apply: (m) => run(m, 'INM', 9, 3),
  },
  {
    title: 'Rechnen: LDA 8, ADD 9',
    target: 'ac',
    body: (
      <>
        <p>Vor dem Rechnen muss ein Operand im AC stehen: {k('LDA 8')} kopiert Zelle 8 in den AC.</p>
        <p>{k('ADD 9')} addiert Zelle 9 zum AC. Das Ergebnis 8 steht jetzt im AC.</p>
      </>
    ),
    apply: (m) => run(run(m, 'LDA', 8), 'ADD', 9),
  },
  {
    title: 'Ausgeben: STA 10, OUTM 10',
    target: 'ausgabe',
    body: (
      <>
        <p>Der AC ist von außen nicht sichtbar. Deshalb wird das Ergebnis mit {k('STA 10')} in Zelle 10 gespeichert und mit {k('OUTM 10')} in die Ausgabe kopiert.</p>
        <p>Die „LEDs“ zeigen das Ergebnis binär, darunter steht es dezimal.</p>
      </>
    ),
    apply: (m) => run(run(m, 'STA', 10), 'OUTM', 10),
  },
  {
    title: 'Das Protokoll',
    target: 'protokoll',
    body: (
      <>
        <p>Jeder ausgeführte Befehl wurde protokolliert. Diese Folge von Anweisungen ist schon fast ein <b>Programm</b>.</p>
        <p>In Altair werden solche Befehlsfolgen als Zahlen im Speicher abgelegt, die der Rechner selbst abarbeitet – der <b>von-Neumann-Zyklus</b>.</p>
      </>
    ),
  },
  {
    title: 'Weitere Befehle, Skins und der Versionswechsel',
    target: 'menu',
    body: (
      <>
        <p>Unter „Ansicht“ lassen sich Schiebebefehle ({k('SHL')}, {k('SHR')}), {k('NEG')} und die Logikbefehle ({k('AND')}, {k('OR')}, {k('XOR')}) einblenden, der AC binär anzeigen und ein Skin wählen.</p>
        <p>Fertig? Dann weiter zu <b>Altair</b> über das Menü „Version“ – mit dem Passwort aus dem Unterricht. Dein Programm bleibt erhalten.</p>
        <p>Nach „Fertig“ ist der Rechner wieder im Zustand von vor dem Guide.</p>
      </>
    ),
  },
]

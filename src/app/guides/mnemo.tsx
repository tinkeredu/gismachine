import type { ReactNode } from 'react'

export const GUIDE_PROGRAM = `; Guide: zwei Zahlen addieren
\tinm zahl1\t; erste Zahl einlesen
\tinm zahl2\t; zweite Zahl einlesen
\tlda zahl1\t; AC := zahl1
\tadd zahl2\t; AC := AC + zahl2
\tsta summe\t; summe := AC
\toutm summe\t; summe ausgeben
\tstop

zahl1\tdef 0
zahl2\tdef 0
summe\tdef 0
`

export interface GuideContext {
  load: (source: string) => void
  microStep: () => void
  step: () => void
  provideInput: (value: number) => void
}

export interface GuideStep {
  title: string
  /** `data-guide` value of the element to highlight. */
  target?: string
  body: ReactNode
  /** Applied when the step is entered; all previous steps are replayed first. */
  apply?: (ctx: GuideContext) => void
}

const k = (s: string) => <code className="rounded bg-code px-1 font-mono">{s}</code>

const PATH_STEP: GuideStep = {
  title: 'Der Weg durch die Versionen',
  body: (
    <>
      <p>Diese App führt in drei Stufen zum Programmieren eines Modellrechners: <b>1 CPU-Direkt</b> → <b>2 Altair</b> → <b>3 MNemo</b>.</p>
      <p>
        Du bist hier bei <b>MNemo</b>, der letzten Stufe: In Altair hast du Befehle als Bitmuster über Schalter eingestellt. Jetzt schreibst du sie als lesbare Befehlswörter (Mnemonics) – der <b>Assembler</b> übersetzt sie in genau diese Bitmuster.
      </p>
      <p>
        Der Speicher bleibt derselbe: 256 Zellen à 16 Bit. Ein aus Altair oder CPU-Direkt übernommenes Programm wird automatisch in einen Quelltext zurückübersetzt (Variablen heißen dann <code className="rounded bg-code px-1 font-mono">z008</code>, Sprungmarken <code className="rounded bg-code px-1 font-mono">m004</code>). Der Wechsel ist passwortgeschützt (Menü „Version“).
      </p>
    </>
  ),
}

const WHERE_STEP: GuideStep = {
  title: 'Was war wo – und wo ist es jetzt?',
  target: 'memory',
  body: (
    <ul className="guide-map">
      <li><b>Speicherwerk:</b> wie in Altair rechts neben dem Prozessor – hier in der Mitte, mit den Befehlen als Text (z. B. <code className="rounded bg-code px-1 font-mono">lda 8</code>) statt Bitmustern.</li>
      <li><b>Befehlswort-Schalter:</b> ersetzt durch den <b>Editor</b> rechts. Statt Bits zu setzen, schreibst du Befehle und klickst „Übersetzen“.</li>
      <li><b>Akkumulator:</b> heißt jetzt <b>Rechenwerk</b> (links oben).</li>
      <li><b>Programmsteuerung:</b> jetzt <b>Steuerung</b> unten links – Einzelschritt, Start, Pause, Reset und Tempo wie gewohnt.</li>
      <li><b>Dateneingabe/-ausgabe:</b> <b>Eingabe</b> ist ein Zahlenfeld statt Schaltern, die <b>Ausgabe</b> eine Liste aller ausgegebenen Werte.</li>
      <li><b>Befehlssatz:</b> Die Befehle aus Altair haben in MNemo dieselben Nummern; dazu kommen u. a. Stack, Unterprogramme, MUL und DIV (56 Befehle).</li>
    </ul>
  ),
}

export const GUIDE_STEPS: GuideStep[] = [
  PATH_STEP,
  WHERE_STEP,
  {
    title: 'Willkommen bei MNemo',
    body: (
      <>
        <p>MNemo ist ein Modellrechner nach dem von-Neumann-Prinzip: Programm und Daten liegen gemeinsam im Speicher, ein Steuerwerk holt Befehl für Befehl und das Rechenwerk rechnet.</p>
        <p>Der Guide lädt ein kleines Beispielprogramm und führt es Schritt für Schritt aus. Dein eigenes Programm wird danach wiederhergestellt.</p>
      </>
    ),
  },
  {
    title: 'Der Editor',
    target: 'editor',
    apply: (c) => c.load(GUIDE_PROGRAM),
    body: (
      <>
        <p>Hier schreibst du das Programm in Mnemonics (z. B. {k('lda')}, {k('add')}). Alles nach {k(';')} ist Kommentar.</p>
        <p>{k('zahl1 def 0')} reserviert eine Speicherzelle (Variable) mit Startwert 0. Mit {k('EQUAL')} definiert man Konstanten, ein allein stehender Name ist eine Sprungmarke.</p>
      </>
    ),
  },
  {
    title: 'Übersetzen',
    target: 'compile',
    body: (
      <>
        <p>„Übersetzen“ (oder Strg+Enter) wandelt den Quelltext in Maschinenwörter um und lädt sie in den Speicher. Fehler und Hinweise erscheinen darunter mit Zeilennummer – ein Klick springt zur Zeile.</p>
        <p>Der Guide hat das Programm bereits übersetzt.</p>
      </>
    ),
  },
  {
    title: 'Das Speicherwerk',
    target: 'memory',
    body: (
      <>
        <p>256 Zellen (000–255) à 16 Bit. Zuerst stehen die Befehle, danach die Variablen: {k('zahl1')} liegt in Zelle 007, {k('zahl2')} in 008, {k('summe')} in 009.</p>
      </>
    ),
  },
  {
    title: 'Der erste Befehl',
    target: 'eingabe',
    apply: (c) => c.step(),
    body: (
      <p>Ein Einzelschritt führt den ersten Befehl aus: {k('inm 7')} liest eine Zahl in Zelle 007. Das Programm hält an, das Eingabefeld wird gelb und wartet. Im normalen Betrieb tippst du hier eine Zahl und drückst Enter.</p>
    ),
  },
  {
    title: 'Eingabe',
    target: 'memory',
    apply: (c) => {
      c.provideInput(12)
      c.step()
      c.provideInput(30)
    },
    body: <p>Der Guide hat 12 und 30 eingegeben. Sie stehen jetzt in den Zellen 007 und 008.</p>,
  },
  {
    title: 'Das Rechenwerk',
    target: 'rechenwerk',
    apply: (c) => {
      c.step()
      c.step()
    },
    body: (
      <p>{k('lda zahl1')} lädt 12 in den Akkumulator (AC), {k('add zahl2')} addiert 30. Alle Rechnungen laufen über den AC – Ergebnis 42. Werte ≥ 32768 werden zusätzlich als negative Zahl angezeigt.</p>
    ),
  },
  {
    title: 'Ausgabe',
    target: 'ausgabe',
    apply: (c) => {
      c.step()
      c.step()
      c.step()
    },
    body: <p>{k('sta summe')} speichert den AC in Zelle 009, {k('outm summe')} gibt sie aus, {k('stop')} beendet das Programm.</p>,
  },
  {
    title: 'Steuerung',
    target: 'steuerung',
    body: (
      <ul className="list-disc pl-5">
        <li>Einzelschritt: einen ganzen Befehl ausführen</li>
        <li>Start / Pause / Zurücksetzen (setzt Register und Speicher auf das übersetzte Programm zurück)</li>
        <li>„Pause nach jedem Befehl“ regelt das Tempo beim Start</li>
      </ul>
    ),
  },
  {
    title: 'Hilfe und Ansicht',
    target: 'menu',
    body: <p>Unter „Hilfe“ findest du den kompletten Befehlssatz. Unter „Ansicht“ blendest du Steuerwerk, AR/DR-Register und den Stack ein und wählst einen Skin (auch Darkmode). Über „Version“ kommst du mit Passwort zurück zu CPU-Direkt oder Altair; das Programm im Speicher wird mitgenommen. Viel Spaß beim Programmieren!</p>,
  },
]


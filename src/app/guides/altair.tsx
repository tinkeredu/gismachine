import type { ReactNode } from 'react'

export interface AltairGuideContext {
  /** Führt einen Befehl des geladenen Beispiels aus. */
  step: () => void
  /** Wählt eine Speicheradresse in den Schaltern. */
  setAddress: (addr: number) => void
}

export interface GuideStep {
  title: string
  target?: string
  body: ReactNode
  /** Findet beim Betreten des Schritts statt; alle vorherigen Schritte werden vorher abgespielt. */
  apply?: (ctx: AltairGuideContext) => void
}

const PATH_STEP: GuideStep = {
  title: 'Der Weg durch die Versionen',
  body: (
    <>
      <p>Diese App führt in drei Stufen zum Programmieren eines Modellrechners: <b>1 CPU-Direkt</b> → <b>2 Altair</b> → <b>3 MNemo</b>.</p>
      <p>
        Du bist hier bei <b>Altair</b>: In CPU-Direkt hast du jeden Befehl von Hand angeklickt. Jetzt stellst du Programme als 16-Bit-Maschinenwörter über Schalter ein – und die CPU führt sie selbst aus.
      </p>
      <p>
        Der Speicher bleibt derselbe: 256 Zellen à 16 Bit. Was du in CPU-Direkt in die Zellen geschrieben hast, siehst du hier als Binärzahlen. Danach folgt MNemo, der Assembler. Der Wechsel ist passwortgeschützt (Menü „Version“).
      </p>
    </>
  ),
}

const WHERE_STEP: GuideStep = {
  title: 'Was war wo – und wo ist es jetzt?',
  target: 'memory',
  body: (
    <ul className="guide-map">
      <li><b>Speicher:</b> in CPU-Direkt die Liste rechts – hier das <b>Speicherwerk</b> rechts. Dieselben 256 Zellen, wahlweise binär, symbolisch, dezimal oder hex.</li>
      <li><b>Akkumulator:</b> war oben im Prozessorbild – jetzt das Feld <b>Akkumulator · AC</b> unter der Programmsteuerung.</li>
      <li><b>Eingabe-Kästchen:</b> werden zur <b>Dateneingabe</b> mit 16 Schaltern; die Ausgabe-LEDs sitzen in der <b>Datenausgabe</b>.</li>
      <li><b>Befehls-Schaltflächen</b> (LDA, ADD …): gibt es nicht mehr. Befehle stehen jetzt als Zahlen im Speicher und werden im <b>Befehlswort</b> eingestellt.</li>
      <li><b>Protokoll:</b> ersetzt durch das Programm selbst – <b>Einzelschritt</b> und <b>Start</b> in der Programmsteuerung arbeiten es ab.</li>
    </ul>
  ),
}

export const GUIDE_STEPS: GuideStep[] = [
  PATH_STEP,
  WHERE_STEP,
  {
    title: 'Willkommen bei Altair',
    body: (
      <>
        <p>Hier programmierst du einen Modellrechner direkt in Maschinensprache. Der Guide führt ein Beispiel vor: die Zahl 13 ausgeben.</p>
        <p>Dein Speicher und Rechnerzustand werden am Ende vollständig wiederhergestellt.</p>
      </>
    ),
  },
  {
    title: 'Speicheradresse wählen',
    target: 'address',
    body: (
      <>
        <p>Die acht Schalter wählen eine Speicheradresse von 0 bis 255. Mit − und + gehst du zur benachbarten Zelle. Auch ein Klick in der Speicherliste wählt eine Zelle aus.</p>
      </>
    ),
  },
  {
    title: 'Das Befehlswort',
    target: 'word',
    body: (
      <>
        <p>Links stehen acht Bits für den Operationscode, rechts acht für die Adresse. Das Beispiel hat in Zelle 0 <code className="rounded bg-code px-1 font-mono">OUTM 8</code> eingetragen: 0001 1000 0000 1000.</p>
        <p>Jede Schalteränderung wird sofort in den Speicher geschrieben.</p>
      </>
    ),
  },
  {
    title: 'Daten eingeben',
    target: 'word',
    apply: (c) => c.setAddress(8),
    body: (
      <>
        <p>Die gleichen 16 Schalter schreiben auch Daten statt Befehlen. In Zelle 8 steht die Zahl 13: 0000 0000 0000 1101.</p>
        <p>Die Dezimal- und Hex-Anzeige helfen beim Kontrollieren.</p>
      </>
    ),
  },
  {
    title: 'Einzelschritt',
    target: 'controls',
    apply: (c) => c.step(),
    body: (
      <>
        <p>Einzelschritt führt einen ganzen Befehl aus. Der Guide hat <code className="rounded bg-code px-1 font-mono">OUTM 8</code> ausgeführt.</p>
        <p>Die Ausgabe-LEDs zeigen jetzt 13. Start führt fortlaufend aus, Pause hält den Lauf an, der Regler bestimmt das Tempo.</p>
      </>
    ),
  },
  {
    title: 'Ausgabe',
    target: 'output',
    body: (
      <>
        <p>Leuchtende LEDs stehen für 1, dunkle für 0. Der letzte Ausgabewert ist zusätzlich als Zahl zu sehen. Das aufklappbare Protokoll enthält die letzten 1000 Ausgaben.</p>
      </>
    ),
  },
  {
    title: 'Programme mit Eingabe',
    target: 'input',
    body: (
      <>
        <p>Bei <code className="rounded bg-code px-1 font-mono">INM</code> hält Altair an und wartet. Stelle die Eingabe über die Schalter oder das Zahlenfeld ein und bestätige sie. Danach kannst du mit Start oder Einzelschritt fortfahren.</p>
      </>
    ),
  },
  {
    title: 'Anhalten und neu starten',
    target: 'controls',
    apply: (c) => c.step(),
    body: (
      <>
        <p><code className="rounded bg-code px-1 font-mono">STOP</code> beendet das Programm – der Guide hat das gerade getan.</p>
        <p>Reset setzt den Prozessor zurück auf Adresse 0; der aktuelle Speicherinhalt bleibt erhalten. Speicher löschen entfernt auch das Programm – erst nach deiner Bestätigung.</p>
      </>
    ),
  },
  {
    title: 'Weiter zu MNemo',
    target: 'menu',
    body: (
      <>
        <p>Unter „Datei“ speicherst und lädst du Programme (auch im PC1-Format), unter „Hilfe“ findest du den durchsuchbaren Befehlssatz. „Ansicht“ bietet fünf Skins und optionale PC/IR- und AR/DR-Register.</p>
        <p>In <b>MNemo</b> schreibst du dasselbe Programm in lesbarer Assembler-Sprache – der Speicher mit seinen 256 Zellen bleibt der rote Faden. Der Wechsel läuft über das Menü „Version“ mit Passwort.</p>
      </>
    ),
  },
]

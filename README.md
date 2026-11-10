# GIS Machine

Eine Webapp für den Informatikunterricht: Der Weg vom manuellen Modellrechner **CPU-Direkt** über den binären **Altair** bis zum Assembler-Programm **MNemo** – in einer App, mit einem gemeinsamen Speicher.

## Die drei Versionen

| Stufe | Version | Was man macht |
| --- | --- | --- |
| 1 | **CPU-Direkt** | 16 Befehle (LDA, STA, ADD, …) per Schaltflächen und 256 Speicherzellen à 16 Bit von Hand steuern. |
| 2 | **Altair** | Programme als 16-Bit-Maschinenwörter über 16 Schalter einstellen und von der CPU automatisch ausführen lassen. |
| 3 | **MNemo** | In lesbarer Assemble-Sprache schreiben; der Assembler übersetzt in dieselben Speicherwörter. 56 Befehle, Stack, Unterprogramme. |

Alle drei Versionen arbeiten auf demselben Speicher: **256 Zellen à 16 Bit**. Register und CPU-Zustand starten bei jedem Wechsel neu (wie nach einem Reset), nur das Programm bleibt erhalten.

## Versionswechsel

Der Wechsel zwischen den Versionen (Menü **Version**) ist passwortgeschützt. Das Standard-Passwort ist `schule`; die Lehrkraft kann es in `src/config.ts` (`SWITCH_PASSWORD`) ändern. Es ist eine Schranke für den Unterricht, kein Sicherheitsschutz.

**Direkteinstieg für die Folgestunde:** Die App merkt sich Version und Programm automatisch. Über **Version → Programm-Link kopieren** entsteht ein Link, der die App direkt in dieser Version mit dem aktuellen Programm öffnet (`#mnemo`, `#altair`, `#cpudirect`, optional mit Programm im Link). Den Link kann man an die Schüler weitergeben.

## Bedienung

- Jede Version hat einen **Guide** (oben rechts „Guide starten“ oder über Hilfe). Er führt Schritt für Schritt durch die Bedienung und erklärt, was in der vorherigen Version wo war und wo es jetzt ist.
- **Ansicht**: fünf Skins – Automatisch (folgt Hell/Dunkel des Systems), Hell, Dunkel, Klassisch (Windows-98-Look) und Terminal (grün auf schwarz). Dazu je nach Version optionale Register (Steuerwerk PC/IR, AR/DR, Stack).
- **Hilfe → Fehler melden** öffnet die Issues-Seite dieses Repos.
- Alle Daten bleiben im Browser (localStorage); es gibt kein Backend und keine Telemetrie.

## Lokal starten

Voraussetzung: Node.js ab Version 22.12.

```sh
npm install
npm run dev      # http://localhost:5173
```

Für eine fertige, statische Version (für einen Webserver):

```sh
npm run build    # erzeugt dist/
npm run preview  # zum Ausprobieren
```

Den Inhalt von `dist/` auf einen beliebigen Webserver legen, z. B. unter `/schule/gismachine/`. Die App muss über `http://` oder `https://` laufen, ein Doppelklick auf `index.html` (file://) funktioniert nicht.

## Tests und Qualität

```sh
npm test         # Vitest: Kerne der drei Rechner, Assembler, Speicher-Transfer, Links, Guides
npm run lint     # oxlint
npm run build    # TypeScript + Vite
```

## Aufbau

```
src/core/cpudirect  CPU-Direkt: Maschinentyp, Reduktion (16 Befehle)
src/core/altair     Altair: 16-Bit-Wörter, 23 Opcodes, Speicher, Beispiele
src/core/mnemo      MNemo: Assembler (56 Befehle), CPU mit Hol-/Dekodier-/Ausführungsphase
src/core/suite.ts   gemeinsamer Speicher, Versionen, Passwort, Direktlinks
src/app/versions/*  die drei Ansichten (Panels, Steuerung, Speicher, Editor)
src/app/guides/*    die drei Guides
src/app/ui.tsx      Menübalken, Dialoge, Kopf- und Statuszeile, Guide-Overlay
src/config.ts       Repository-URL und SWITCH_PASSWORD
```

Die Kerne wurden aus den eigenständigen Projekten [giscpud](https://github.com/tinkeredu/giscpud), [gisaltair](https://github.com/tinkeredu/gisaltair) und [gismnemo](https://github.com/tinkeredu/gismnemo) übernommen; dort gibt es auch die ausführlichen Hilfen und Befehlssätze der Originalprogramme.

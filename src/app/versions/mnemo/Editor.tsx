import { useRef, useState } from 'react'
import type { AssembleResult, Diagnostic } from '../../../core/mnemo/assembler'

const LINE_HEIGHT = 18

interface Props {
  source: string
  onChange: (source: string) => void
  result: AssembleResult | null
  onCompile: () => void
  onClearResult: () => void
  currentLine: number | null
  fileName: string
  onFileNameChange: (name: string) => void
}

export function Editor({ source, onChange, result, onCompile, onClearResult, currentLine, fileName, onFileNameChange }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const lineCount = source.split('\n').length

  const compile = onCompile

  const gotoLine = (line: number) => {
    const ta = textRef.current
    if (!ta) return
    const lines = source.split('\n')
    const start = lines.slice(0, line).reduce((n, l) => n + l.length + 1, 0)
    ta.focus()
    ta.setSelectionRange(start, start + (lines[line]?.length ?? 0))
    ta.scrollTop = Math.max(0, line * LINE_HEIGHT - ta.clientHeight / 3)
  }

  const save = () => {
    const blob = new Blob([source.replace(/\n/g, '\r\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName.endsWith('.mno') ? fileName : `${fileName}.mno`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const open = async (file: File | undefined) => {
    if (!file) return
    const buf = await file.arrayBuffer()
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      text = new TextDecoder('windows-1252').decode(buf)
    }
    onChange(text.replace(/\r\n?/g, '\n'))
    onFileNameChange(file.name)
    onClearResult()
  }

  const row = (d: Diagnostic, kind: string) => (
    <li key={`${kind}${d.line}-${d.code}`}>
      <button type="button" className="w-full px-1 text-left hover:bg-sel hover:text-sel-fg" onClick={() => gotoLine(d.line)}>
        Zeile: {d.line}
        {'   '}
        {d.code}
        {'  '}
        {d.message}
      </button>
    </li>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1" data-guide="editor-toolbar">
        <button type="button" className="btn" onClick={() => { onChange(''); onFileNameChange('programm.mno'); onClearResult() }}>
          Neu
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Öffnen…
        </button>
        <button type="button" className="btn" onClick={save}>
          Speichern
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".mno,.txt,text/plain"
          className="hidden"
          onChange={(e) => {
            void open(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className="ml-1 truncate text-xs text-muted" title={fileName}>
          {fileName}
        </span>
        <button type="button" className="btn ml-auto font-bold" onClick={compile} data-guide="compile">
          Übersetzen
        </button>
      </div>
      <div className="sunken flex min-h-0 flex-1 overflow-hidden font-mono text-[13px]" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
        <div ref={gutterRef} aria-hidden className="relative w-10 shrink-0 overflow-hidden border-r border-line bg-gutter text-right text-muted select-none">
          <div style={{ transform: `translateY(${-scrollTop}px)` }} className="py-1">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className={`pr-1 ${i === currentLine ? 'bg-sel text-sel-fg' : ''}`}>
                {i}
              </div>
            ))}
          </div>
        </div>
        <textarea
          ref={textRef}
          aria-label="Quelltext"
          value={source}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const ta = e.currentTarget
              const { selectionStart: s, selectionEnd: t } = ta
              onChange(source.slice(0, s) + '\t' + source.slice(t))
              requestAnimationFrame(() => ta.setSelectionRange(s + 1, s + 1))
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              compile()
            }
          }}
          className="min-w-0 flex-1 resize-none bg-field text-fg px-2 py-1 outline-none"
          style={{ tabSize: 8 }}
        />
      </div>
      <div aria-label="Meldungen" data-guide="messages" className="sunken h-36 shrink-0 overflow-y-auto font-mono text-[13px] whitespace-pre">
        {!result && <p className="px-1 text-muted">Strg+Enter oder „Übersetzen“ übersetzt das Programm und lädt es in den Speicher.</p>}
        {result?.ok && (
          <p className="px-1 text-ok">
            Übersetzung erfolgreich – {result.codeSize} Befehle, {result.variables.size} Variablen geladen.
          </p>
        )}
        {result && result.errors.length > 0 && (
          <>
            <p className="px-1 font-bold text-err">******Fehler******</p>
            <ul>{result.errors.map((d) => row(d, 'e'))}</ul>
          </>
        )}
        {result && result.hints.length > 0 && (
          <>
            <p className="px-1 font-bold text-info">******Hinweise******</p>
            <ul>{result.hints.map((d) => row(d, 'h'))}</ul>
          </>
        )}
      </div>
    </div>
  )
}

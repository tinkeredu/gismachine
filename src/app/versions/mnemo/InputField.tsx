import { useEffect, useRef, useState } from 'react'

const parse = (text: string) => {
  const t = text.trim()
  if (!/^[+-]?\d+$/.test(t)) return null
  const n = Number(t)
  return n >= -32768 && n <= 65535 ? n : null
}

export function InputField({ active, onSubmit }: { active: boolean; onSubmit: (value: number) => void }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) ref.current?.focus()
  }, [active])

  const submit = () => {
    const n = parse(text)
    if (n === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText('')
    onSubmit(n)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex gap-1"
    >
      <input
        ref={ref}
        aria-label="Eingabe"
        disabled={!active}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setInvalid(false)
        }}
        inputMode="numeric"
        className={`sunken w-full px-1 font-mono outline-none ${active ? 'bg-input-active!' : 'opacity-60'} ${invalid ? 'border-err!' : ''}`}
      />
      <button type="submit" className="btn" disabled={!active}>
        OK
      </button>
    </form>
  )
}

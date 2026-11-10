import { useCallback, useEffect, useState } from 'react'
import { Cpu } from '../../../core/altair/cpu'

export function useMachine(initial: number[]) {
  const [cpu] = useState(() => new Cpu(initial))
  const [, setVersion] = useState(0)
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(300)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const pause = useCallback(() => setRunning(false), [])

  useEffect(() => {
    if (!running || cpu.state !== 'ready') return
    let handle = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      for (let i = 0; i < (delay ? 1 : 250); i++) {
        if (cpu.state !== 'ready') break
        cpu.step()
      }
      refresh()
      if (cpu.state !== 'ready') { setRunning(false); return }
      handle = window.setTimeout(tick, Math.max(delay, 16))
    }
    handle = window.setTimeout(tick, Math.max(delay, 16))
    return () => { cancelled = true; clearTimeout(handle) }
  }, [cpu, running, delay, refresh])

  const step = useCallback(() => { setRunning(false); cpu.step(); refresh() }, [cpu, refresh])
  const reset = useCallback(() => { setRunning(false); cpu.reset(); refresh() }, [cpu, refresh])
  const load = useCallback((memory: number[]) => {
    setRunning(false)
    cpu.loadMemory(memory)
    refresh()
  }, [cpu, refresh])
  const provideInput = useCallback((value: number) => { cpu.provideInput(value); refresh() }, [cpu, refresh])
  return { cpu, running, delay, setDelay, refresh, pause, step, reset, load, provideInput, run: () => { if (cpu.state === 'ready') setRunning(true) } }
}

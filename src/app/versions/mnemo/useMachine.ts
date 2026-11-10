import { useCallback, useEffect, useState } from 'react'
import { Cpu } from '../../../core/mnemo/cpu'

/** Steps executed per animation frame when "Pause nach jedem Befehl" is 0. */
const BURST = 2000

export function useMachine(initial?: number[]) {
  const [cpu] = useState(() => new Cpu(initial))
  const [, setVersion] = useState(0)
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(300)
  const [alert, setAlert] = useState<string | null>(null)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const afterStep = useCallback(() => {
    if (cpu.state === 'halted' || cpu.state === 'error') setRunning(false)
    if (cpu.state === 'error' && cpu.error) setAlert(cpu.error)
    refresh()
  }, [cpu, refresh])

  useEffect(() => {
    if (!running) return
    let cancelled = false
    let handle = 0
    const tick = () => {
      if (cancelled) return
      if (cpu.state === 'ready') {
        if (delay === 0) {
          for (let i = 0; i < BURST && cpu.state === 'ready'; i++) cpu.step()
        } else {
          cpu.step()
        }
        afterStep()
      }
      if (cpu.state === 'halted' || cpu.state === 'error') return
      handle = delay === 0 ? requestAnimationFrame(tick) : window.setTimeout(tick, delay)
    }
    handle = delay === 0 ? requestAnimationFrame(tick) : window.setTimeout(tick, delay)
    return () => {
      cancelled = true
      cancelAnimationFrame(handle)
      clearTimeout(handle)
    }
  }, [running, delay, cpu, afterStep])

  const run = useCallback(() => {
    if (cpu.state === 'halted' || cpu.state === 'error') return
    setRunning(true)
  }, [cpu])

  const pause = useCallback(() => setRunning(false), [])

  const step = useCallback(() => {
    if (cpu.state !== 'ready') return
    setRunning(false)
    cpu.step()
    afterStep()
  }, [cpu, afterStep])

  const microStep = useCallback(() => {
    if (cpu.state !== 'ready') return
    setRunning(false)
    cpu.microStep()
    afterStep()
  }, [cpu, afterStep])

  const reset = useCallback(
    (image?: number[]) => {
      setRunning(false)
      cpu.reset(image)
      refresh()
    },
    [cpu, refresh],
  )

  const provideInput = useCallback(
    (value: number) => {
      cpu.provideInput(value)
      refresh()
    },
    [cpu, refresh],
  )

  return {
    cpu,
    running,
    delay,
    setDelay,
    alert,
    dismissAlert: () => setAlert(null),
    run,
    pause,
    step,
    microStep,
    reset,
    provideInput,
  }
}

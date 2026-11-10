const box = { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true } as const

export const PlayIcon = () => (
  <svg {...box}>
    <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
  </svg>
)
export const PauseIcon = () => (
  <svg {...box}>
    <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" />
  </svg>
)
export const StopIcon = () => (
  <svg {...box}>
    <path d="M2.5 2.5h9v9h-9z" fill="currentColor" />
  </svg>
)
export const StepIcon = () => (
  <svg {...box}>
    <path d="M2 1.5v11l7-5.5zM10 2h2.5v10H10z" fill="currentColor" />
  </svg>
)
export const PhaseIcon = () => (
  <svg {...box}>
    <path d="M3 3.5v7l5-3.5z" fill="currentColor" />
    <path d="M10 3v8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
  </svg>
)

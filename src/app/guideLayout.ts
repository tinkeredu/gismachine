export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function guidePosition(target: Rect | null, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const margin = 8
  const gap = 16
  const maxLeft = Math.max(margin, viewport.width - card.width - margin)
  const maxTop = Math.max(margin, viewport.height - card.height - margin)
  let left = (viewport.width - card.width) / 2
  let top = (viewport.height - card.height) / 2

  if (target) {
    if (viewport.width - target.left - target.width >= card.width + gap + margin) {
      left = target.left + target.width + gap
      top = target.top
    } else if (target.left >= card.width + gap + margin) {
      left = target.left - card.width - gap
      top = target.top
    } else {
      left = target.left
      const below = target.top + target.height + gap
      top = below <= maxTop ? below : target.top - card.height - gap
    }
  }

  return { left: Math.max(margin, Math.min(left, maxLeft)), top: Math.max(margin, Math.min(top, maxTop)) }
}

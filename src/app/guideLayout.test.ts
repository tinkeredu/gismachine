import { describe, expect, it } from 'vitest'
import { guidePosition, type Rect } from './guideLayout'

describe('guidePosition', () => {
  const card = { width: 380, height: 300 }

  it('centers the welcome card without a target', () => {
    expect(guidePosition(null, { width: 1400, height: 900 }, card)).toEqual({ left: 510, top: 300 })
  })

  it('places the card beside a target when there is space', () => {
    expect(guidePosition({ top: 80, left: 20, width: 300, height: 150 }, { width: 1400, height: 900 }, card))
      .toEqual({ left: 336, top: 80 })
    expect(guidePosition({ top: 80, left: 1000, width: 300, height: 150 }, { width: 1400, height: 900 }, card))
      .toEqual({ left: 604, top: 80 })
  })

  it('places the card below or above a full-width target', () => {
    expect(guidePosition({ top: 80, left: 8, width: 800, height: 150 }, { width: 820, height: 1000 }, card).top).toBe(246)
    expect(guidePosition({ top: 700, left: 8, width: 800, height: 150 }, { width: 820, height: 1000 }, card).top).toBe(384)
  })

  it.each([
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ])('keeps cards inside a $width × $height viewport after resizing', (viewport) => {
    const fittedCard = { width: Math.min(380, viewport.width - 16), height: Math.min(420, viewport.height - 16) }
    const targets: (Rect | null)[] = [null,
      { top: 10, left: 8, width: viewport.width - 16, height: 200 },
      { top: viewport.height - 50, left: viewport.width - 120, width: 100, height: 50 },
      { top: -200, left: -50, width: 300, height: 100 },
    ]
    for (const target of targets) {
      const position = guidePosition(target, viewport, fittedCard)
      expect(position.left).toBeGreaterThanOrEqual(8)
      expect(position.top).toBeGreaterThanOrEqual(8)
      expect(position.left + fittedCard.width).toBeLessThanOrEqual(viewport.width - 8)
      expect(position.top + fittedCard.height).toBeLessThanOrEqual(viewport.height - 8)
    }
  })
})

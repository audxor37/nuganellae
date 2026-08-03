import { describe, expect, test, vi } from 'vitest'
import {
  calculateFiveSecondResult,
  calculateTimingResult,
  createBalancedNumberLayout,
  createMemoryDeck,
  getNumberPathDistance,
  getReactionDelayMs,
  getReactionFeedback,
  getTimingStartDirection,
  getTimingStopPosition,
} from './mechanics'

function sequenceSource(values) {
  const queue = [...values]
  return vi.fn((buffer) => {
    buffer[0] = queue.length > 0 ? queue.shift() : 0
    return buffer
  })
}

describe('reaction mechanics', () => {
  test('uses a 1.5 to 4 second signal window', () => {
    expect(getReactionDelayMs(sequenceSource([0]))).toBe(1500)
    expect(getReactionDelayMs(sequenceSource([2500]))).toBe(4000)
  })

  test.each([
    [249, '매우 빠른 반응이에요!'],
    [250, '빠른 반응이에요!'],
    [400, '빠른 반응이에요!'],
    [401, '조금만 더 빠르게 눌러 보세요!'],
  ])('maps %dms to useful feedback', (reactionMs, expected) => {
    expect(getReactionFeedback(reactionMs)).toBe(expected)
  })
})

test('five second scoring separates elapsed time from absolute error', () => {
  expect(calculateFiveSecondResult(5200)).toEqual({
    diffMs: 200,
    elapsedMs: 5200,
    rankMetric: 200,
  })
})

describe('timing stop mechanics', () => {
  test('chooses either start direction from the random source', () => {
    expect(getTimingStartDirection(sequenceSource([0]))).toBe(1)
    expect(getTimingStartDirection(sequenceSource([1]))).toBe(-1)
  })

  test('mirrors the same movement when the start direction changes', () => {
    const fromLeft = getTimingStopPosition(200, 1600, 1)
    const fromRight = getTimingStopPosition(200, 1600, -1)

    expect(fromLeft + fromRight).toBeCloseTo(100, 8)
  })

  test('scores distance from the center on a 0 to 100 scale', () => {
    expect(calculateTimingResult(49.25)).toMatchObject({
      distance: 0.75,
      rankMetric: 0.75,
      scoreValue: 98.5,
    })
  })
})

test('number layouts contain 1 through 9 with a path distance of 16', () => {
  const layout = createBalancedNumberLayout(sequenceSource(Array(1000).fill(0)))

  expect([...layout].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  expect(getNumberPathDistance(layout)).toBe(16)
})

test('memory deck contains six different icon pairs', () => {
  const deck = createMemoryDeck(sequenceSource(Array(100).fill(0)))
  const counts = deck.reduce((result, icon) => ({
    ...result,
    [icon]: (result[icon] || 0) + 1,
  }), {})

  expect(deck).toHaveLength(12)
  expect(Object.values(counts)).toEqual([2, 2, 2, 2, 2, 2])
})

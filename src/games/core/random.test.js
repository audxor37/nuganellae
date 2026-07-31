import { describe, expect, test, vi } from 'vitest'
import { randomInt, shuffle } from './random'

function sequenceSource(values) {
  const queue = [...values]
  return vi.fn((buffer) => {
    buffer[0] = queue.shift()
    return buffer
  })
}

describe('randomInt', () => {
  test('rejects the modulo overflow range before returning an unbiased index', () => {
    const source = sequenceSource([0xffffffff, 4])

    expect(randomInt(3, source)).toBe(1)
    expect(source).toHaveBeenCalledTimes(2)
  })

  test('rejects invalid ranges', () => {
    expect(() => randomInt(0, sequenceSource([0]))).toThrow('maxExclusive')
  })
})

test('shuffle returns a new Fisher-Yates ordering without mutating the source', () => {
  const values = ['민수', '지훈', '수진', '영희']
  const result = shuffle(values, sequenceSource([0, 0, 0]))

  expect(result).toEqual(['지훈', '수진', '영희', '민수'])
  expect(values).toEqual(['민수', '지훈', '수진', '영희'])
})

import { describe, expect, test, vi } from 'vitest'
import {
  createEnvelopeAssignments,
  createRouletteGradient,
  getRouletteRotation,
} from './mechanics'

function zeroSource(buffer) {
  buffer[0] = 0
  return buffer
}

describe('roulette mechanics', () => {
  test('rotates the selected sector center to the top pointer after full turns', () => {
    expect(getRouletteRotation({ participantCount: 4, selectedIndex: 2, turns: 4 })).toBe(1260)
  })

  test('builds one equally sized color sector per participant', () => {
    const gradient = createRouletteGradient(3)

    expect(gradient).toContain('0deg 120deg')
    expect(gradient).toContain('120deg 240deg')
    expect(gradient).toContain('240deg 360deg')
  })
})

test('envelope assignments are a shuffled one-to-one participant mapping', () => {
  const participants = ['민수', '지훈', '수진', '영희']
  const assignments = createEnvelopeAssignments(participants, vi.fn(zeroSource))

  expect(assignments).toEqual(['지훈', '수진', '영희', '민수'])
  expect(new Set(assignments).size).toBe(participants.length)
})

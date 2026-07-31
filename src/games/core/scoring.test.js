import { describe, expect, test } from 'vitest'
import {
  createGameScore,
  formatGameScore,
  getSettlementTargetScores,
  rankScores,
} from './scoring'

describe('game scoring', () => {
  test('keeps ranking precision separate from the displayed value and unit', () => {
    const score = createGameScore({
      participant: '민수',
      rawValue: 5200.125,
      rankMetric: 200.125,
      displayValue: '5.200',
      unit: '초',
    })

    expect(score.rankMetric).toBe(200.125)
    expect(formatGameScore(score)).toBe('5.200초')
  })

  test('ranks lower metrics first and preserves exact ties', () => {
    const ranked = rankScores([
      createGameScore({ participant: '민수', rawValue: 2, rankMetric: 2, displayValue: '2', unit: '점' }),
      createGameScore({ participant: '지훈', rawValue: 1, rankMetric: 1, displayValue: '1', unit: '점' }),
      createGameScore({ participant: '수진', rawValue: 1, rankMetric: 1, displayValue: '1', unit: '점' }),
    ])

    expect(ranked.map(({ participant, rank }) => [participant, rank])).toEqual([
      ['지훈', 1],
      ['수진', 1],
      ['민수', 3],
    ])
  })

  test('selects first place normally and last place for extra payment', () => {
    const ranked = [
      { participant: '민수', rank: 1 },
      { participant: '지훈', rank: 2 },
      { participant: '수진', rank: 2 },
    ]

    expect(getSettlementTargetScores(ranked, 'exempt').map((score) => score.participant)).toEqual(['민수'])
    expect(getSettlementTargetScores(ranked, 'extra').map((score) => score.participant)).toEqual(['지훈', '수진'])
  })
})

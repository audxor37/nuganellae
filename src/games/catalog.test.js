import { describe, expect, test } from 'vitest'
import { gameCatalog, getGameById } from './catalog'

describe('game catalog', () => {
  test('publishes the seven approved games with player and duration metadata', () => {
    expect(gameCatalog.map((game) => game.id)).toEqual([
      'roulette',
      'receiptEnvelope',
      'reaction',
      'fiveSeconds',
      'timingStop',
      'numberOrder',
      'memoryCard',
    ])

    for (const game of gameCatalog) {
      expect(game.recommendedPlayers).toMatchObject({ min: 2, max: expect.any(Number) })
      expect(game.estimatedSecondsPerPlayer).toBeGreaterThan(0)
      expect(['random', 'ranking']).toContain(game.category)
    }
  })

  test('maps removed game ids to roulette for stale selections', () => {
    expect(getGameById('fastRandom').id).toBe('roulette')
    expect(getGameById('movingTarget').id).toBe('roulette')
  })
})

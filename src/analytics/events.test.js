import { expect, test } from 'vitest'
import { sanitizeAnalyticsProperties } from './events'

test('analytics removes names, exact amounts, titles, and share content', () => {
  expect(sanitizeAnalyticsProperties({
    source: 'home',
    mode: 'exempt',
    game_id: 'roulette',
    participant_count: 4,
    amount: 84000,
    amount_bucket: '50000-99999',
    title: '강남역 삼겹살',
    participants: ['민수', '지훈'],
    share_text: '민수 28,000원',
    unknown: 'drop',
  })).toEqual({
    source: 'home',
    mode: 'exempt',
    game_id: 'roulette',
    participant_count: 4,
    amount_bucket: '50000-99999',
  })
})

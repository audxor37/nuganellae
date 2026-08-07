import { expect, test } from 'vitest'
import { buildSettlementDeepLink } from './share-link'

test('shared deep links exclude participant names, titles, and exact amounts', () => {
  const link = buildSettlementDeepLink({
    title: '강남역 삼겹살',
    amount: 84000,
    participants: ['민수', '지훈'],
    mode: 'exempt',
    gameId: 'roulette',
  })

  expect(link).toBe('intoss://nuganellae/start?source=share&mode=exempt&gameId=roulette')
  expect(link).not.toContain('%EB%AF%BC%EC%88%98')
  expect(link).not.toContain('84000')
})

test('shared deep links omit unavailable optional context', () => {
  expect(buildSettlementDeepLink({ mode: 'equal' })).toBe(
    'intoss://nuganellae/start?source=share&mode=equal',
  )
  expect(buildSettlementDeepLink({})).toBe(
    'intoss://nuganellae/start?source=share',
  )
})

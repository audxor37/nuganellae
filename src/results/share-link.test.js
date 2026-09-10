import { expect, test } from 'vitest'
import { buildSettlementDeepLink, parseSettlementShareSnapshot } from './share-link'

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

test('shared deep links can include a settlement result snapshot', () => {
  const link = buildSettlementDeepLink({
    gameId: 'roulette',
    mode: 'exempt',
    shareSnapshot: {
      amount: 84000,
      gameId: 'roulette',
      lineItems: [
        { participant: '민수', amount: 84000, amountText: '84,000원', description: '분담', highlighted: false },
        { participant: '영희', amount: 0, amountText: '0원', description: '면제', highlighted: true },
      ],
      mode: 'exempt',
      modeLabel: '한 명 면제',
      participants: ['민수', '영희'],
      selectedParticipant: '영희',
      summaryText: '영희 님이 면제됐어요.',
      title: '강남역 삼겹살',
    },
  })

  const result = new URL(link).searchParams.get('result')

  expect(result).toBeTruthy()
  expect(parseSettlementShareSnapshot(result)).toMatchObject({
    amount: 84000,
    gameId: 'roulette',
    mode: 'exempt',
    modeLabel: '한 명 면제',
    participants: ['민수', '영희'],
    selectedParticipant: '영희',
    summaryText: '영희 님이 면제됐어요.',
    title: '강남역 삼겹살',
  })
  expect(parseSettlementShareSnapshot(result).lineItems).toHaveLength(2)
})

test('validates shared participant membership and exact integer totals before reuse', () => {
  const valid = { amount: 10, participants: [' 가 ', '나'], mode: 'unknown', gameId: 'unknown', lineItems: [
    { participant: ' 가 ', amount: 5 }, { participant: '나', amount: 5 },
  ] }
  expect(parseSettlementShareSnapshot(JSON.stringify(valid))).toMatchObject({ participants: ['가', '나'], mode: 'exempt', gameId: 'roulette', allowReselect: false })
  for (const patch of [
    { amount: 10.5 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { amount: '10' },
    { participants: ['가', ' 가 '] }, { participants: ['가'] },
    { lineItems: [{ participant: '가', amount: 10 }] },
    { lineItems: [{ participant: '가', amount: 5 }, { participant: '다', amount: 5 }] },
    { lineItems: [{ participant: '가', amount: 6 }, { participant: '나', amount: 5 }] },
    { lineItems: [{ participant: '가', amount: 10.5 }, { participant: '나', amount: -0.5 }] },
  ]) expect(parseSettlementShareSnapshot(JSON.stringify({ ...valid, ...patch }))).toBeNull()
})

test('shared deep links omit unavailable optional context', () => {
  expect(buildSettlementDeepLink({ mode: 'equal' })).toBe(
    'intoss://nuganellae/start?source=share&mode=equal',
  )
  expect(buildSettlementDeepLink({})).toBe(
    'intoss://nuganellae/start?source=share',
  )
})

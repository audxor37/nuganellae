import { describe, expect, test } from 'vitest'
import { calculateSettlementResult } from './settlement'

const participants = ['민수', '지훈', '수진', '영희']

describe.each([
  ['equal', [15000, 15000, 15000, 15001]],
  ['exempt', [0, 20000, 20000, 20001]],
  ['extra', [24000, 12000, 12000, 12001]],
  ['discount', [7500, 17500, 17500, 17501]],
])('%s settlement', (settlementMode, expectedAmounts) => {
  test('allocates integer won while preserving the exact total', () => {
    const result = calculateSettlementResult({
      amount: 60001,
      participants,
      selectedParticipant: '민수',
      settlementMode,
    })

    expect(result.lineItems.map((item) => item.amount)).toEqual(expectedAmounts)
    expect(result.lineItems.reduce((sum, item) => sum + item.amount, 0)).toBe(60001)
  })
})

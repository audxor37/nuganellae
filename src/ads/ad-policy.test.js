import { expect, test } from 'vitest'
import { getNextAdFrequencyState, shouldShowInterstitial } from './ad-policy'

test('shows an interstitial only on every third completion after the cooldown', () => {
  const now = Date.parse('2026-07-31T12:00:00.000Z')

  expect(shouldShowInterstitial({ completedCount: 2, lastInterstitialAt: null }, now)).toBe(false)
  expect(shouldShowInterstitial({ completedCount: 3, lastInterstitialAt: null }, now)).toBe(true)
  expect(shouldShowInterstitial({
    completedCount: 6,
    lastInterstitialAt: new Date(now - (5 * 60 * 1000)).toISOString(),
  }, now)).toBe(false)
  expect(shouldShowInterstitial({
    completedCount: 6,
    lastInterstitialAt: new Date(now - (11 * 60 * 1000)).toISOString(),
  }, now)).toBe(true)
})

test('records completions and impressions independently', () => {
  const state = getNextAdFrequencyState({ completedCount: 2, lastInterstitialAt: null }, {
    type: 'SETTLEMENT_COMPLETED',
  })
  expect(state.completedCount).toBe(3)

  expect(getNextAdFrequencyState(state, {
    type: 'INTERSTITIAL_SHOWN',
    now: '2026-07-31T12:00:00.000Z',
  })).toEqual({
    completedCount: 3,
    lastInterstitialAt: '2026-07-31T12:00:00.000Z',
  })
})

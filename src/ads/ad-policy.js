export const interstitialCooldownMs = 10 * 60 * 1000

export function shouldShowInterstitial(state, now = Date.now()) {
  if (!state || !Number.isSafeInteger(state.completedCount) || state.completedCount < 3 ||
      state.completedCount - (state.lastInterstitialCompletedCount ?? 0) < 3) {
    return false
  }

  if (!state.lastInterstitialAt) {
    return true
  }

  return now - Date.parse(state.lastInterstitialAt) >= interstitialCooldownMs
}

export function getNextAdFrequencyState(state = {
  completedCount: 0,
  lastInterstitialAt: null,
  lastInterstitialCompletedCount: 0,
}, action) {
  if (action.type === 'SETTLEMENT_COMPLETED') {
    return {
      ...state,
      completedCount: state.completedCount + 1,
    }
  }

  if (action.type === 'INTERSTITIAL_SHOWN') {
    return {
      ...state,
      lastInterstitialAt: action.now,
      lastInterstitialCompletedCount: action.completedCount ?? state.completedCount,
    }
  }

  return state
}

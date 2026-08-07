export function buildSettlementDeepLink({ mode, gameId }) {
  const params = new URLSearchParams({ source: 'share' })
  if (mode) {
    params.set('mode', mode)
  }
  if (gameId) {
    params.set('gameId', gameId)
  }

  return `intoss://nuganellae/start?${params.toString()}`
}

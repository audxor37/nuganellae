function normalizeLineItem(item) {
  return {
    amount: Number(item?.amount || 0),
    amountText: String(item?.amountText || ''),
    description: String(item?.description || ''),
    highlighted: Boolean(item?.highlighted),
    participant: String(item?.participant || ''),
  }
}

export function createSettlementShareSnapshot(payload) {
  return {
    amount: Number(payload?.amount || 0),
    gameId: payload?.gameId || null,
    lineItems: Array.isArray(payload?.lineItems)
      ? payload.lineItems.map(normalizeLineItem)
      : [],
    mode: payload?.mode || 'equal',
    modeLabel: String(payload?.modeLabel || ''),
    participants: Array.isArray(payload?.participants)
      ? payload.participants.map((participant) => String(participant))
      : [],
    selectedParticipant: String(payload?.selectedParticipant || ''),
    summaryText: String(payload?.summaryText || ''),
    title: String(payload?.title || ''),
  }
}

export function parseSettlementShareSnapshot(value) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    const snapshot = createSettlementShareSnapshot(parsed)
    if (!Number.isFinite(snapshot.amount) || snapshot.amount <= 0 || snapshot.participants.length === 0) {
      return null
    }

    return snapshot
  } catch {
    return null
  }
}

export function buildSettlementDeepLink({ mode, gameId, shareSnapshot }) {
  const params = new URLSearchParams({ source: 'share' })
  if (mode) {
    params.set('mode', mode)
  }
  if (gameId) {
    params.set('gameId', gameId)
  }
  if (shareSnapshot) {
    params.set('result', JSON.stringify(createSettlementShareSnapshot(shareSnapshot)))
  }

  return `intoss://nuganellae/start?${params.toString()}`
}

import { normalizeReusableSetup } from '../storage/settlement-storage'
import { formatWon, settlementModes } from '../games/core/settlement'

function normalizeLineItem(item) {
  return {
    amount: Number(item?.amount || 0),
    amountText: formatWon(Number(item?.amount || 0)),
    description: String(item?.description || ''),
    highlighted: Boolean(item?.highlighted),
    participant: String(item?.participant || '').trim(),
  }
}

export function createSettlementShareSnapshot(payload) {
  const setup = normalizeReusableSetup(payload)
  return {
    amount: Number(payload?.amount || 0),
    gameId: setup?.selectedGameId || 'roulette',
    allowReselect: setup?.allowReselect || false,
    lineItems: Array.isArray(payload?.lineItems)
      ? payload.lineItems.map(normalizeLineItem)
      : [],
    mode: setup?.settlementMode || 'exempt',
    modeLabel: settlementModes.find((mode) => mode.id === (setup?.settlementMode || 'exempt')).title,
    participants: Array.isArray(payload?.participants)
      ? payload.participants.map((participant) => String(participant).trim())
      : [],
    selectedParticipant: String(payload?.selectedParticipant || '').trim(),
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
    const setup = normalizeReusableSetup(parsed)
    if (!setup || !Number.isSafeInteger(parsed.amount) || parsed.amount <= 0) return null
    if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length !== setup.participants.length) return null
    const itemNames = new Set()
    let total = 0
    for (const item of parsed.lineItems) {
      if (!item || typeof item.participant !== 'string' || !Number.isSafeInteger(item.amount) || item.amount < 0) return null
      const name = item.participant.trim()
      if (!setup.participants.includes(name) || itemNames.has(name)) return null
      itemNames.add(name)
      total += item.amount
      if (!Number.isSafeInteger(total)) return null
    }
    if (total !== parsed.amount) return null
    if (parsed.selectedParticipant && (typeof parsed.selectedParticipant !== 'string' || !setup.participants.includes(parsed.selectedParticipant.trim()))) return null
    const snapshot = createSettlementShareSnapshot(parsed)
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

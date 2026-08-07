export const storageKeys = {
  draft: 'draft:v1',
  settlements: 'settlements:v1',
  adFrequency: 'ad-frequency:v1',
  anonymousId: 'anonymous-id:v1',
  analyticsOptOut: 'analytics-opt-out:v1',
}

const ownedKeys = Object.values(storageKeys)

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeDraft(value) {
  if (!isPlainObject(value) || value.version !== 1) return null
  if (![
    'title',
    'amount',
    'participants',
    'method',
    'exempt',
    'gameSelect',
  ].includes(value.step)) return null
  if (!Array.isArray(value.participants) || !value.participants.every(isNonEmptyString)) return null
  if (!isFiniteNonNegativeNumber(value.amount)) return null

  return value
}

function isSettlementRecord(value) {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    isNonEmptyString(value.completedAt) &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    isFiniteNonNegativeNumber(value.amount) &&
    Array.isArray(value.participants) &&
    value.participants.every(isNonEmptyString) &&
    Array.isArray(value.lineItems) &&
    value.lineItems.every(
      (item) =>
        isPlainObject(item) &&
        isNonEmptyString(item.participant) &&
        typeof item.amountText === 'string',
    )
  )
}

function normalizeSettlements(value) {
  if (!Array.isArray(value)) return []
  return value.filter(isSettlementRecord)
}

function normalizeAdFrequency(value) {
  if (!isPlainObject(value)) {
    return { completedCount: 0, lastInterstitialAt: null }
  }

  const completedCount =
    Number.isInteger(value.completedCount) && value.completedCount >= 0
      ? value.completedCount
      : 0
  const lastInterstitialAt =
    value.lastInterstitialAt === null ||
    (isNonEmptyString(value.lastInterstitialAt) &&
      !Number.isNaN(Date.parse(value.lastInterstitialAt)))
      ? value.lastInterstitialAt
      : null

  return { completedCount, lastInterstitialAt }
}

function parseStoredValue(value, fallback, normalize) {
  if (value == null) {
    return fallback
  }

  return normalize(JSON.parse(value))
}

export function createSettlementRepository(storage) {
  let writeQueue = Promise.resolve()

  function enqueueWrite(operation) {
    const result = writeQueue.then(operation, operation)
    writeQueue = result
    return result
  }

  async function load(key, fallback, normalize = (value) => value) {
    const storedValue = await storage.getItem(key)

    try {
      return parseStoredValue(storedValue, fallback, normalize)
    } catch {
      await enqueueWrite(() => storage.removeItem(key)).catch(() => undefined)
      return fallback
    }
  }

  async function save(key, value) {
    await enqueueWrite(() => storage.setItem(key, JSON.stringify(value)))
  }

  return {
    loadDraft: () => load(storageKeys.draft, null, normalizeDraft),
    saveDraft: (draft) => save(storageKeys.draft, draft),
    removeDraft: () => enqueueWrite(() => storage.removeItem(storageKeys.draft)),
    loadSettlements: () => load(storageKeys.settlements, [], normalizeSettlements),
    saveSettlements: (records) => save(storageKeys.settlements, records),
    loadAdFrequency: () =>
      load(
        storageKeys.adFrequency,
        {
          completedCount: 0,
          lastInterstitialAt: null,
        },
        normalizeAdFrequency,
      ),
    saveAdFrequency: (state) => save(storageKeys.adFrequency, state),
    loadAnalyticsOptOut: () =>
      load(
        storageKeys.analyticsOptOut,
        false,
        (value) => (typeof value === 'boolean' ? value : false),
      ),
    saveAnalyticsOptOut: (value) => save(storageKeys.analyticsOptOut, Boolean(value)),
    getAnonymousId: () =>
      load(
        storageKeys.anonymousId,
        null,
        (value) => (isNonEmptyString(value) ? value : null),
      ),
    saveAnonymousId: (value) => save(storageKeys.anonymousId, value),
    clearAppData: () =>
      enqueueWrite(() => Promise.all(ownedKeys.map((key) => storage.removeItem(key)))),
  }
}

function groupKey(participants) {
  return [...participants].sort((left, right) => left.localeCompare(right, 'ko')).join('|')
}

export function deriveRecentGroups(records) {
  const groups = new Map()

  records.forEach((record) => {
    const id = groupKey(record.participants || [])
    const current = groups.get(id)
    if (!current || record.completedAt > current.lastUsedAt) {
      groups.set(id, {
        id,
        participants: [...record.participants],
        lastUsedAt: record.completedAt,
        usageCount: (current?.usageCount || 0) + 1,
      })
      return
    }

    current.usageCount += 1
  })

  return [...groups.values()].sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
}

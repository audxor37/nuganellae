export const allowedAnalyticsProperties = new Set([
  'source',
  'stage',
  'mode',
  'game_id',
  'participant_count',
  'amount_bucket',
  'duration_bucket',
  'share_method',
  'ad_type',
  'failure_reason',
])

export function sanitizeAnalyticsProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => allowedAnalyticsProperties.has(key)),
  )
}

export function getAmountBucket(amount) {
  if (amount < 10000) return '0-9999'
  if (amount < 50000) return '10000-49999'
  if (amount < 100000) return '50000-99999'
  if (amount < 300000) return '100000-299999'
  return '300000+'
}

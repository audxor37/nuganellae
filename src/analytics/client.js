import { sanitizeAnalyticsProperties } from './events'

export function createAnalyticsClient({ apiKey, deviceId, enabled, sdk }) {
  let trackingEnabled = Boolean(enabled && apiKey)
  let initialized = false

  return {
    initialize() {
      if (!trackingEnabled || initialized) {
        return false
      }

      sdk.init(apiKey, undefined, {
        autocapture: false,
        defaultTracking: false,
        deviceId,
        identityStorage: 'none',
      })
      sdk.setOptOut?.(false)
      initialized = true
      return true
    },

    setEnabled(value) {
      trackingEnabled = Boolean(value && apiKey)
      sdk.setOptOut?.(!trackingEnabled)
    },

    track(eventName, properties = {}) {
      if (!trackingEnabled || !eventName) {
        return false
      }

      try {
        sdk.track(eventName, sanitizeAnalyticsProperties(properties))
        return true
      } catch {
        // Analytics failure must not interrupt settlement or native ad cleanup.
        return false
      }
    },
  }
}

export async function initializeAnalyticsClient({
  apiKey,
  deviceId,
  source = 'direct',
  isOptedOut = () => false,
  loadSdk,
}) {
  if (!apiKey || !deviceId || isOptedOut()) {
    return null
  }

  const sdk = await loadSdk()
  if (isOptedOut()) {
    return null
  }

  const client = createAnalyticsClient({
    apiKey,
    deviceId,
    enabled: true,
    sdk,
  })
  if (!client.initialize()) {
    return null
  }

  client.track('app_opened', { source: source === 'share' ? 'share' : 'direct' })
  return client
}

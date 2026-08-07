import { expect, test, vi } from 'vitest'
import {
  createAnalyticsClient,
  initializeAnalyticsClient,
} from './client'

test('initializes Amplitude without cookies or automatic capture', () => {
  const sdk = {
    init: vi.fn(),
    setOptOut: vi.fn(),
    track: vi.fn(),
  }
  const analytics = createAnalyticsClient({
    apiKey: 'amplitude-key',
    deviceId: 'anonymous-device-id',
    enabled: true,
    sdk,
  })

  analytics.initialize()

  expect(sdk.init).toHaveBeenCalledWith('amplitude-key', undefined, expect.objectContaining({
    autocapture: false,
    deviceId: 'anonymous-device-id',
    identityStorage: 'none',
  }))
  expect(sdk.setOptOut).toHaveBeenCalledWith(false)
})

test('tracks only allowlisted properties and becomes a no-op after opt-out', () => {
  const sdk = {
    init: vi.fn(),
    setOptOut: vi.fn(),
    track: vi.fn(),
  }
  const analytics = createAnalyticsClient({
    apiKey: 'amplitude-key',
    deviceId: 'anonymous-device-id',
    enabled: true,
    sdk,
  })

  analytics.track('settlement_completed', {
    mode: 'equal',
    participant_count: 4,
    title: '비공개 모임',
    amount: 50000,
  })
  analytics.setEnabled(false)
  analytics.track('share_completed', { share_method: 'copy' })

  expect(sdk.track).toHaveBeenCalledTimes(1)
  expect(sdk.track).toHaveBeenCalledWith('settlement_completed', {
    mode: 'equal',
    participant_count: 4,
  })
  expect(sdk.setOptOut).toHaveBeenCalledWith(true)
})

test('does not initialize after the user opts out while the SDK is loading', async () => {
  let releaseSdk
  let optedOut = false
  const sdk = {
    init: vi.fn(),
    setOptOut: vi.fn(),
    track: vi.fn(),
  }
  const pendingClient = initializeAnalyticsClient({
    apiKey: 'amplitude-key',
    deviceId: 'anonymous-device-id',
    isOptedOut: () => optedOut,
    loadSdk: () => new Promise((resolve) => {
      releaseSdk = () => resolve(sdk)
    }),
  })

  optedOut = true
  releaseSdk()

  await expect(pendingClient).resolves.toBeNull()
  expect(sdk.init).not.toHaveBeenCalled()
  expect(sdk.track).not.toHaveBeenCalled()
})

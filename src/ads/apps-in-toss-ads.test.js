import { describe, expect, test, vi } from 'vitest'
import { attachHistoryBanner, createInterstitialAd } from './apps-in-toss-ads'

describe('AppsInToss ads adapter', () => {
  test('preloads and shows an interstitial without exposing callback details to the app', async () => {
    const disposeLoad = vi.fn()
    const disposeShow = vi.fn()
    const load = Object.assign(vi.fn(({ onEvent }) => {
      onEvent({ type: 'loaded' })
      return disposeLoad
    }), { isSupported: vi.fn(() => true) })
    const show = Object.assign(vi.fn(({ onEvent }) => {
      onEvent({ type: 'impression' })
      onEvent({ type: 'dismissed' })
      return disposeShow
    }), { isSupported: vi.fn(() => true) })
    const ad = createInterstitialAd({
      enabled: true,
      groupId: 'interstitial-group',
      load,
      show,
    })

    await expect(ad.preload()).resolves.toBe(true)
    await expect(ad.show()).resolves.toBe('dismissed')
    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      options: { adGroupId: 'interstitial-group' },
    }))
    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      options: { adGroupId: 'interstitial-group' },
    }))
    expect(disposeLoad).toHaveBeenCalledTimes(1)
    expect(disposeShow).toHaveBeenCalledTimes(1)
  })

  test('returns safe fallbacks when ads are disabled or unsupported', async () => {
    const load = Object.assign(vi.fn(), { isSupported: vi.fn(() => false) })
    const show = Object.assign(vi.fn(), { isSupported: vi.fn(() => false) })
    const ad = createInterstitialAd({ enabled: true, groupId: 'group', load, show })

    await expect(ad.preload()).resolves.toBe(false)
    await expect(ad.show()).resolves.toBe('skipped')
  })

  test('disposes a preload listener when the SDK times out', async () => {
    vi.useFakeTimers()
    try {
      const disposeLoad = vi.fn()
      const load = Object.assign(vi.fn(() => disposeLoad), {
        isSupported: vi.fn(() => true),
      })
      const show = Object.assign(vi.fn(), {
        isSupported: vi.fn(() => true),
      })
      const ad = createInterstitialAd({
        enabled: true,
        groupId: 'interstitial-group',
        load,
        show,
      })

      const pendingPreload = ad.preload()
      await vi.advanceTimersByTimeAsync(1500)

      await expect(pendingPreload).resolves.toBe(false)
      expect(disposeLoad).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test('attaches a history banner and always returns a cleanup function', () => {
    const destroy = vi.fn()
    let initializeCallbacks
    const ads = {
      initialize: Object.assign(vi.fn(({ callbacks }) => {
        initializeCallbacks = callbacks
      }), { isSupported: vi.fn(() => true) }),
      attachBanner: Object.assign(vi.fn(() => ({ destroy })), { isSupported: vi.fn(() => true) }),
    }
    const target = document.createElement('div')

    const cleanup = attachHistoryBanner({
      ads,
      enabled: true,
      groupId: 'banner-group',
      target,
    })

    expect(ads.initialize).toHaveBeenCalled()
    expect(ads.attachBanner).not.toHaveBeenCalled()
    initializeCallbacks.onInitialized()
    expect(ads.attachBanner).toHaveBeenCalledWith('banner-group', target, expect.any(Object))
    cleanup()
    expect(destroy).toHaveBeenCalled()
  })

  test('does not attach a late banner after its target has unmounted', () => {
    let initializeCallbacks
    const ads = {
      initialize: Object.assign(vi.fn(({ callbacks }) => {
        initializeCallbacks = callbacks
      }), { isSupported: vi.fn(() => true) }),
      attachBanner: Object.assign(vi.fn(), { isSupported: vi.fn(() => true) }),
    }

    const cleanup = attachHistoryBanner({
      ads,
      enabled: true,
      groupId: 'banner-group',
      target: document.createElement('div'),
    })

    cleanup()
    initializeCallbacks.onInitialized()
    expect(ads.attachBanner).not.toHaveBeenCalled()
  })
})

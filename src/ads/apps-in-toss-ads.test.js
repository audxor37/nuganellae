import { describe, expect, test, vi } from 'vitest'
import { attachHistoryBanner, createInterstitialAd } from './apps-in-toss-ads'

describe('AppsInToss ads adapter', () => {
  function interstitialHarness(onEvent = vi.fn()) {
    let showCallbacks
    const cleanup = vi.fn()
    const load = Object.assign(vi.fn(({ onEvent }) => onEvent({ type: 'loaded' })), { isSupported: () => true })
    const show = Object.assign(vi.fn((callbacks) => { showCallbacks = callbacks; return cleanup }), { isSupported: () => true })
    const ad = createInterstitialAd({ enabled: true, groupId: 'group', load, show, onEvent })
    return { ad, load, show, cleanup, onEvent, emit: (type) => showCallbacks.onEvent({ type }) }
  }

  test.each(['show', 'impression'])('waits for dismissal after %s even when viewing exceeds the old timeout', async (startEvent) => {
    vi.useFakeTimers()
    try {
      const h = interstitialHarness()
      await h.ad.preload()
      const done = vi.fn()
      const pending = h.ad.show().then(done)
      h.emit(startEvent)
      await vi.advanceTimersByTimeAsync(30000)
      expect(done).not.toHaveBeenCalled()
      expect(h.cleanup).not.toHaveBeenCalled()
      h.emit('impression')
      h.emit('impression')
      h.emit('dismissed')
      h.emit('dismissed')
      await pending
      expect(done).toHaveBeenCalledOnce()
      expect(done).toHaveBeenCalledWith('dismissed')
      expect(h.onEvent.mock.calls.filter(([e]) => e.type === 'impression')).toHaveLength(1)
      expect(h.cleanup).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  test('start timeout permits navigation once but observes late display and blocks further ads', async () => {
    vi.useFakeTimers()
    try {
      const h = interstitialHarness()
      const listener = vi.fn()
      await h.ad.preload()
      const pending = h.ad.show({ onEvent: listener })
      await vi.advanceTimersByTimeAsync(5000)
      await expect(pending).resolves.toBe('failed')
      expect(h.cleanup).not.toHaveBeenCalled()
      h.emit('show')
      h.emit('impression')
      h.emit('impression')
      h.emit('dismissed')
      expect(listener.mock.calls.filter(([e]) => e.type === 'show')).toHaveLength(1)
      expect(listener.mock.calls.filter(([e]) => e.type === 'impression')).toHaveLength(1)
      expect(h.cleanup).toHaveBeenCalledOnce()
      await expect(h.ad.preload()).resolves.toBe(false)
      await expect(h.ad.show()).resolves.toBe('skipped')
      expect(h.show).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  test('deduplicates preloads, ignores late load and remains reusable after disposal', async () => {
    vi.useFakeTimers()
    try {
      let callbacks
      const load = Object.assign(vi.fn((args) => { callbacks = args; return vi.fn() }), { isSupported: () => true })
      const show = Object.assign(vi.fn(), { isSupported: () => true })
      const ad = createInterstitialAd({ enabled: true, groupId: 'g', load, show })
      const first = ad.preload()
      expect(ad.preload()).toBe(first)
      await vi.advanceTimersByTimeAsync(10000)
      await expect(first).resolves.toBe(false)
      callbacks.onEvent({ type: 'loaded' })
      await expect(ad.show()).resolves.toBe('skipped')
      const second = ad.preload()
      ad.dispose()
      await expect(second).resolves.toBe(false)
      const third = ad.preload()
      callbacks.onEvent({ type: 'loaded' })
      await expect(third).resolves.toBe(true)
      expect(load).toHaveBeenCalledTimes(3)
    } finally { vi.useRealTimers() }
  })

  test('deduplicates banner impressions and collapses failed synchronous attachment', () => {
    let callbacks
    const destroy = vi.fn()
    const onEvent = vi.fn()
    const onState = vi.fn()
    const ads = {
      initialize: Object.assign(({ callbacks }) => callbacks.onInitialized(), { isSupported: () => true }),
      attachBanner: Object.assign((_id, _target, options) => { callbacks = options.callbacks; return { destroy } }, { isSupported: () => true }),
    }
    const cleanup = attachHistoryBanner({ ads, enabled: true, groupId: 'g', target: document.createElement('div'), onEvent, onState })
    callbacks.onAdRendered()
    callbacks.onAdImpression()
    callbacks.onAdImpression()
    callbacks.onAdViewable()
    callbacks.onAdViewable()
    expect(onEvent.mock.calls.filter(([e]) => e.type === 'impression')).toHaveLength(1)
    expect(onEvent.mock.calls.filter(([e]) => e.type === 'viewable')).toHaveLength(1)
    callbacks.onNoFill()
    expect(onState).toHaveBeenLastCalledWith('unavailable')
    cleanup()
    expect(destroy).toHaveBeenCalledOnce()

    const syncDestroy = vi.fn()
    ads.attachBanner = Object.assign((_id, _target, { callbacks }) => { callbacks.onNoFill(); return { destroy: syncDestroy } }, { isSupported: () => true })
    attachHistoryBanner({ ads, enabled: true, groupId: 'g', target: document.createElement('div'), onState })()
    expect(syncDestroy).toHaveBeenCalledOnce()
  })

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
      await vi.advanceTimersByTimeAsync(10000)

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

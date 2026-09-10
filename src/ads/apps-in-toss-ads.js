const preloadTimeoutMs = 10000
const showStartTimeoutMs = 5000

function isCallableAdApi(api) {
  return typeof api === 'function' && api.isSupported?.() === true
}

// Callbacks can run synchronously, before the SDK returns its unsubscribe function.
function subscription() {
  let cleanup
  let closed = false
  return {
    set(value) {
      if (typeof value !== 'function') return
      if (closed) value()
      else cleanup = value
    },
    close() {
      if (closed) return
      closed = true
      cleanup?.()
      cleanup = null
    },
  }
}

export function createInterstitialAd({ enabled, groupId, load, show, onEvent }) {
  let ready = false
  let loading = null
  let showing = false
  let blocked = false
  const operations = new Set()
  const emit = (event, listener) => { onEvent?.(event); listener?.(event) }
  const unavailable = (api) => !enabled ? 'disabled' : !groupId ? 'missing_group' :
    blocked ? 'start_timeout_blocked' : !isCallableAdApi(api) ? 'unsupported' : null

  function preload() {
    const reason = unavailable(load)
    if (reason || showing) {
      emit({ type: 'skipped', reason: reason || 'show_in_progress' })
      return Promise.resolve(false)
    }
    if (ready) return Promise.resolve(true)
    if (loading) return loading
    let resolvePromise
    const promise = new Promise((resolve) => { resolvePromise = resolve })
    loading = promise
    const sub = subscription()
    let finished = false
    const finish = (value, reason) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      ready = value
      loading = null
      operations.delete(cancel)
      sub.close()
      emit({ type: value ? 'loaded' : 'failed', stage: 'load', ...(reason ? { reason } : {}) })
      resolvePromise(value)
    }
    const cancel = () => finish(false, 'disposed')
    operations.add(cancel)
    const timer = setTimeout(() => finish(false, 'load_timeout'), preloadTimeoutMs)
    emit({ type: 'requested', stage: 'load' })
    try {
      sub.set(load({
        options: { adGroupId: groupId },
        onEvent: (event) => { if (event?.type === 'loaded') finish(true) },
        onError: () => finish(false, 'load_error'),
      }))
    } catch { finish(false, 'load_error') }
    return promise
  }

  function showAd({ onEvent: listener } = {}) {
    const reason = unavailable(show) || (showing ? 'show_in_progress' : !ready ? 'not_ready' : null)
    if (reason) {
      emit({ type: 'skipped', reason }, listener)
      return Promise.resolve('skipped')
    }
    ready = false
    showing = true
    return new Promise((resolve) => {
      const sub = subscription()
      const seen = new Set()
      let ended = false
      let resolved = false
      const report = (type, reason) => {
        if (seen.has(type)) return
        seen.add(type)
        emit({ type, stage: 'show', ...(reason ? { reason } : {}) }, listener)
      }
      const settle = (result) => {
        if (resolved) return
        resolved = true
        resolve(result)
      }
      const finish = (result, reason) => {
        if (ended) return
        ended = true
        clearTimeout(timer)
        showing = false
        operations.delete(cancel)
        sub.close()
        report(result === 'dismissed' ? 'dismissed' : 'failed', reason)
        settle(result)
      }
      const cancel = () => finish('failed', 'disposed')
      operations.add(cancel)
      const timer = setTimeout(() => {
        blocked = true
        // Unsubscribing cannot cancel a native ad. Observe late display events.
        report('failed', 'start_timeout')
        settle('failed')
      }, showStartTimeoutMs)
      report('requested')
      try {
        sub.set(show({
          options: { adGroupId: groupId },
          onEvent: (event) => {
            if (ended) return
            if (event?.type === 'show' || event?.type === 'impression') {
              clearTimeout(timer)
              report(event.type)
            } else if (event?.type === 'dismissed') finish('dismissed')
            else if (event?.type === 'clicked') report('clicked')
            else if (event?.type === 'failedToShow') finish('failed', 'show_error')
          },
          onError: () => finish('failed', 'show_error'),
        }))
      } catch { finish('failed', 'show_error') }
    })
  }

  return {
    preload,
    show: showAd,
    dispose() {
      for (const cancel of [...operations]) cancel()
      ready = false
    },
  }
}

export function attachHistoryBanner({ ads, enabled, groupId, target, onEvent, onState }) {
  let disposed = false
  let unavailable = false
  let initialized = false
  let slot = null
  const seen = new Set()
  const report = (type, reason) => {
    if (disposed || seen.has(type)) return
    seen.add(type)
    onEvent?.({ type, ...(reason ? { reason } : {}) })
  }
  const destroy = () => { slot?.destroy?.(); slot = null }
  const fail = (reason) => {
    if (disposed || unavailable) return
    unavailable = true
    report('failed', reason)
    onState?.('unavailable')
    destroy()
  }
  if (!enabled || !groupId || !target || ads?.initialize?.isSupported?.() !== true || ads?.attachBanner?.isSupported?.() !== true) {
    report('skipped', !enabled ? 'disabled' : !groupId ? 'missing_group' : 'unsupported')
    onState?.('unavailable')
    return () => { disposed = true }
  }
  onState?.('loading')
  report('requested')
  try {
    ads.initialize({
      callbacks: {
        onInitialized: () => {
          if (disposed || unavailable || initialized) return
          initialized = true
          report('loaded')
          try {
            slot = ads.attachBanner(groupId, target, {
              theme: 'auto', tone: 'grey', variant: 'expanded',
              callbacks: {
                onAdRendered: () => {
                  if (disposed || unavailable) return
                  report('rendered')
                  onState?.('rendered')
                },
                onAdImpression: () => { if (!unavailable) report('impression') },
                onAdViewable: () => { if (!unavailable) report('viewable') },
                onAdClicked: () => { if (!unavailable) report('clicked') },
                onAdFailedToRender: () => fail('render_error'),
                onNoFill: () => fail('no_fill'),
              },
            })
            if (disposed || unavailable) destroy()
          } catch { fail('attach_error') }
        },
        onInitializationFailed: () => fail('initialize_error'),
      },
    })
  } catch { fail('initialize_error') }
  return () => { disposed = true; destroy() }
}

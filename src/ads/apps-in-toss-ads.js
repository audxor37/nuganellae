const adTimeoutMs = 1500

function isCallableAdApi(api) {
  return typeof api === 'function' && api.isSupported?.() === true
}

export function createInterstitialAd({ enabled, groupId, load, show }) {
  let ready = false

  function preload() {
    if (!enabled || !groupId || !isCallableAdApi(load)) {
      return Promise.resolve(false)
    }

    return new Promise((resolve) => {
      let settled = false
      let cleanup = null
      let cleanupRequested = false
      const dispose = () => {
        if (cleanup) {
          const currentCleanup = cleanup
          cleanup = null
          currentCleanup()
          return
        }
        cleanupRequested = true
      }
      const finish = (value) => {
        if (settled) {
          return
        }
        settled = true
        globalThis.clearTimeout(timeoutId)
        ready = value
        dispose()
        resolve(value)
      }
      const timeoutId = globalThis.setTimeout(() => finish(false), adTimeoutMs)

      try {
        const returnedCleanup = load({
          options: { adGroupId: groupId },
          onEvent: (event) => {
            if (event?.type === 'loaded') {
              finish(true)
            }
          },
          onError: () => {
            finish(false)
          },
        })
        cleanup = typeof returnedCleanup === 'function' ? returnedCleanup : null
        if (cleanupRequested) {
          dispose()
        }
      } catch {
        finish(false)
      }
    })
  }

  function showAd() {
    if (!ready || !enabled || !groupId || !isCallableAdApi(show)) {
      return Promise.resolve('skipped')
    }

    ready = false
    return new Promise((resolve) => {
      let settled = false
      let cleanup = null
      let cleanupRequested = false
      const dispose = () => {
        if (cleanup) {
          const currentCleanup = cleanup
          cleanup = null
          currentCleanup()
          return
        }
        cleanupRequested = true
      }
      const finish = (result) => {
        if (settled) {
          return
        }
        settled = true
        globalThis.clearTimeout(timeoutId)
        dispose()
        resolve(result)
      }
      const timeoutId = globalThis.setTimeout(() => finish('failed'), adTimeoutMs)

      try {
        const returnedCleanup = show({
          options: { adGroupId: groupId },
          onEvent: (event) => {
            if (event?.type === 'dismissed') {
              finish('dismissed')
            } else if (event?.type === 'failedToShow') {
              finish('failed')
            }
          },
          onError: () => {
            finish('failed')
          },
        })
        cleanup = typeof returnedCleanup === 'function' ? returnedCleanup : null
        if (cleanupRequested) {
          dispose()
        }
      } catch {
        finish('failed')
      }
    })
  }

  return {
    preload,
    show: showAd,
  }
}

export function attachHistoryBanner({ ads, enabled, groupId, target }) {
  if (!enabled || !groupId || !target || ads?.initialize?.isSupported?.() !== true || ads?.attachBanner?.isSupported?.() !== true) {
    return () => {}
  }

  let disposed = false
  let slot = null

  try {
    ads.initialize({
      callbacks: {
        onInitialized: () => {
          if (disposed) {
            return
          }

          try {
            slot = ads.attachBanner(groupId, target, {
              theme: 'auto',
              tone: 'grey',
              variant: 'expanded',
              callbacks: {
                onAdFailedToRender: () => {},
                onNoFill: () => {},
              },
            })
            if (disposed) {
              slot?.destroy?.()
              slot = null
            }
          } catch {
            slot = null
          }
        },
        onInitializationFailed: () => {},
      },
    })
    return () => {
      disposed = true
      slot?.destroy?.()
      slot = null
    }
  } catch {
    disposed = true
    return () => {}
  }
}

import { describe, expect, test } from 'vitest'
import {
  createSettlementRepository,
  deriveRecentGroups,
  storageKeys,
} from './settlement-storage'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
    values,
  }
}

describe('settlement storage repository', () => {
  test('isolates malformed records and keeps other app data readable', async () => {
    const storage = createMemoryStorage({
      [storageKeys.settlements]: '{broken',
      [storageKeys.draft]: JSON.stringify({
        version: 1,
        step: 'amount',
        participants: [],
        amount: 0,
      }),
    })
    const repository = createSettlementRepository(storage)

    await expect(repository.loadSettlements()).resolves.toEqual([])
    await expect(repository.loadDraft()).resolves.toMatchObject({ step: 'amount' })
    expect(storage.values.has(storageKeys.settlements)).toBe(false)
  })

  test('clears only keys owned by this app', async () => {
    const storage = createMemoryStorage({
      [storageKeys.draft]: '{}',
      [storageKeys.lastSetup]: '{}',
      [storageKeys.appSettings]: '{}',
      [storageKeys.settlements]: '[]',
      'another-feature': 'keep',
    })
    const repository = createSettlementRepository(storage)

    await repository.clearAppData()

    expect(storage.values.get('another-feature')).toBe('keep')
    expect(storage.values.has(storageKeys.draft)).toBe(false)
    expect(storage.values.has(storageKeys.lastSetup)).toBe(false)
    expect(storage.values.has(storageKeys.appSettings)).toBe(false)
    expect(storage.values.has(storageKeys.settlements)).toBe(false)
  })

  test('surfaces device storage read failures to the app', async () => {
    const storage = {
      getItem: async () => {
        throw new Error('bridge unavailable')
      },
      setItem: async () => undefined,
      removeItem: async () => undefined,
    }

    await expect(
      createSettlementRepository(storage).loadSettlements(),
    ).rejects.toThrow('bridge unavailable')
  })

  test('filters valid JSON with incompatible settlement records and normalizes ad state', async () => {
    const validRecord = {
      id: 'record-1',
      title: '저녁 모임',
      amount: 42000,
      participants: ['민수', '지훈'],
      lineItems: [],
      completedAt: '2026-07-31T10:00:00.000Z',
    }
    const storage = createMemoryStorage({
      [storageKeys.settlements]: JSON.stringify([{}, validRecord]),
      [storageKeys.adFrequency]: JSON.stringify({
        completedCount: -3,
        lastInterstitialAt: 'not-a-date',
      }),
    })
    const repository = createSettlementRepository(storage)

    await expect(repository.loadSettlements()).resolves.toEqual([validRecord])
    await expect(repository.loadAdFrequency()).resolves.toEqual({
      completedCount: 0,
      lastInterstitialAt: null,
    })
  })

  test('accepts every resumable app draft step and rejects obsolete steps', async () => {
    const resumableSteps = [
      'title',
      'amount',
      'participants',
      'method',
      'exempt',
      'gameSelect',
    ]

    for (const step of resumableSteps) {
      const storage = createMemoryStorage({
        [storageKeys.draft]: JSON.stringify({
          version: 1,
          step,
          participants: ['민수', '지훈'],
          amount: 42000,
        }),
      })
      await expect(
        createSettlementRepository(storage).loadDraft(),
      ).resolves.toMatchObject({ step })
    }

    const obsoleteStorage = createMemoryStorage({
      [storageKeys.draft]: JSON.stringify({
        version: 1,
        step: 'setup',
        participants: ['민수', '지훈'],
        amount: 42000,
      }),
    })
    await expect(
      createSettlementRepository(obsoleteStorage).loadDraft(),
    ).resolves.toBeNull()
  })

  test('loads and saves the last quick-start setup', async () => {
    const storedSetup = {
      version: 1,
      amount: 84000,
      participants: ['민수', '지훈', '수진'],
      settlementMode: 'exempt',
      selectedGameId: 'roulette',
      allowReselect: true,
      updatedAt: '2026-08-31T10:00:00.000Z',
    }
    const storage = createMemoryStorage({
      [storageKeys.lastSetup]: JSON.stringify(storedSetup),
    })
    const repository = createSettlementRepository(storage)

    await expect(repository.loadLastSetup()).resolves.toEqual(storedSetup)
    await repository.saveLastSetup({ ...storedSetup, selectedGameId: 'reaction' })

    expect(storage.values.get(storageKeys.lastSetup)).toBe(JSON.stringify({
      ...storedSetup,
      selectedGameId: 'reaction',
    }))
  })

  test('rejects incompatible last quick-start setup data', async () => {
    const storage = createMemoryStorage({
      [storageKeys.lastSetup]: JSON.stringify({
        version: 1,
        amount: 50000,
        participants: ['민수'],
        settlementMode: 'exempt',
        selectedGameId: 'roulette',
      }),
    })

    await expect(createSettlementRepository(storage).loadLastSetup()).resolves.toBeNull()
  })

  test('loads and saves app settings with safe defaults', async () => {
    const storage = createMemoryStorage({
      [storageKeys.appSettings]: JSON.stringify({
        version: 1,
        defaultSettlementMode: 'discount',
        defaultGameId: 'reaction',
        defaultAllowReselect: true,
        updatedAt: '2026-09-01T10:00:00.000Z',
      }),
    })
    const repository = createSettlementRepository(storage)

    await expect(repository.loadAppSettings()).resolves.toEqual({
      version: 1,
      defaultSettlementMode: 'discount',
      defaultGameId: 'reaction',
      defaultAllowReselect: true,
      updatedAt: '2026-09-01T10:00:00.000Z',
    })
    await repository.saveAppSettings({
      version: 1,
      defaultSettlementMode: 'extra',
      defaultGameId: 'memoryCard',
      defaultAllowReselect: false,
      updatedAt: '2026-09-01T11:00:00.000Z',
    })

    expect(storage.values.get(storageKeys.appSettings)).toBe(JSON.stringify({
      version: 1,
      defaultSettlementMode: 'extra',
      defaultGameId: 'memoryCard',
      defaultAllowReselect: false,
      updatedAt: '2026-09-01T11:00:00.000Z',
    }))
  })

  test('removes draft settlement history and app settings independently', async () => {
    const storage = createMemoryStorage({
      [storageKeys.draft]: '{}',
      [storageKeys.settlements]: '[]',
      [storageKeys.appSettings]: '{}',
    })
    const repository = createSettlementRepository(storage)

    await repository.removeDraft()
    await repository.removeSettlements()
    await repository.removeAppSettings()

    expect(storage.values.has(storageKeys.draft)).toBe(false)
    expect(storage.values.has(storageKeys.settlements)).toBe(false)
    expect(storage.values.has(storageKeys.appSettings)).toBe(false)
  })
})

test('recent groups combine records with the same participants regardless of order', () => {
  const groups = deriveRecentGroups([
    { id: '1', participants: ['민수', '지훈'], completedAt: '2026-07-30T10:00:00.000Z' },
    { id: '2', participants: ['지훈', '민수'], completedAt: '2026-07-31T10:00:00.000Z' },
    { id: '3', participants: ['수진', '영희'], completedAt: '2026-07-29T10:00:00.000Z' },
  ])

  expect(groups).toEqual([
    {
      id: '민수|지훈',
      participants: ['지훈', '민수'],
      lastUsedAt: '2026-07-31T10:00:00.000Z',
      usageCount: 2,
    },
    {
      id: '수진|영희',
      participants: ['수진', '영희'],
      lastUsedAt: '2026-07-29T10:00:00.000Z',
      usageCount: 1,
    },
  ])
})

test('serializes writes so clearAppData always runs after pending saves', async () => {
  let releaseSave
  const operations = []
  const values = new Map()
  const storage = {
    getItem: async () => null,
    setItem: async (key, value) => {
      operations.push(`set:${key}`)
      await new Promise((resolve) => {
        releaseSave = resolve
      })
      values.set(key, value)
    },
    removeItem: async (key) => {
      operations.push(`remove:${key}`)
      values.delete(key)
    },
  }
  const repository = createSettlementRepository(storage)

  const pendingSave = repository.saveDraft({ step: 'amount' })
  const pendingClear = repository.clearAppData()
  await Promise.resolve()

  expect(operations).toEqual([`set:${storageKeys.draft}`])
  releaseSave()
  await Promise.all([pendingSave, pendingClear])

  expect(values.has(storageKeys.draft)).toBe(false)
  expect(operations.indexOf(`remove:${storageKeys.draft}`)).toBeGreaterThan(operations.indexOf(`set:${storageKeys.draft}`))
})

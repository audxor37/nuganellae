import { describe, expect, test } from 'vitest'
import { createInitialFlowState, settlementFlowReducer } from './flow'

describe('settlementFlowReducer', () => {
  test('moves through the three main settlement stages', () => {
    let state = createInitialFlowState()

    state = settlementFlowReducer(state, { type: 'START' })
    expect(state.stage).toBe('setup')

    state = settlementFlowReducer(state, { type: 'COMPLETE_SETUP' })
    expect(state.stage).toBe('choose')

    state = settlementFlowReducer(state, { type: 'START_PLAY' })
    expect(state.stage).toBe('play')

    state = settlementFlowReducer(state, { type: 'COMPLETE' })
    expect(state.stage).toBe('result')
  })

  test('restores a saved draft without silently changing its stage', () => {
    const draft = {
      version: 1,
      stage: 'choose',
      title: '여름 모임',
      amount: 48000,
      participants: ['민수', '지훈'],
      mode: 'exempt',
      gameId: 'roulette',
      allowReselect: false,
      updatedAt: '2026-07-31T00:00:00.000Z',
    }

    expect(settlementFlowReducer(createInitialFlowState(), {
      type: 'RESTORE_DRAFT',
      payload: draft,
    })).toMatchObject({ stage: 'choose', draft })
  })
})

import { describe, expect, test } from 'vitest'
import { createInitialGameSession, gameSessionReducer } from './session'

describe('game session reducer', () => {
  test('aborting an active turn preserves the player and completed scores', () => {
    const playing = {
      ...createInitialGameSession(),
      currentPlayerIndex: 1,
      playerOrder: ['민수', '지훈'],
      scores: [{ participant: '민수', rankMetric: 200 }],
      status: 'playing',
    }

    const aborted = gameSessionReducer(playing, {
      type: 'ABORT_ACTIVE_TURN',
      payload: { reason: 'background' },
    })

    expect(aborted).toMatchObject({
      abortReason: 'background',
      currentPlayerIndex: 1,
      scores: playing.scores,
      status: 'playing',
    })
  })

  test('records each participant once and finishes after the final turn', () => {
    let state = gameSessionReducer(createInitialGameSession(), {
      type: 'START_SESSION',
      payload: { gameId: 'reaction', playerOrder: ['민수', '지훈'] },
    })

    state = gameSessionReducer(state, {
      type: 'COMPLETE_TURN',
      payload: { participant: '민수', score: { participant: '민수', rankMetric: 200 } },
    })
    state = gameSessionReducer(state, {
      type: 'COMPLETE_TURN',
      payload: { participant: '민수', score: { participant: '민수', rankMetric: 100 } },
    })

    expect(state.scores).toHaveLength(1)
    expect(state.currentPlayerIndex).toBe(1)

    state = gameSessionReducer(state, {
      type: 'COMPLETE_TURN',
      payload: { participant: '지훈', score: { participant: '지훈', rankMetric: 180 } },
    })

    expect(state.status).toBe('result')
    expect(state.scores).toHaveLength(2)
  })

  test('discarding a result clears scores and starts a fresh order', () => {
    const completed = {
      ...createInitialGameSession(),
      gameId: 'reaction',
      playerOrder: ['민수', '지훈'],
      scores: [{ participant: '민수', rankMetric: 200 }],
      status: 'result',
    }

    const restarted = gameSessionReducer(completed, {
      type: 'DISCARD_AND_RESTART',
      payload: { playerOrder: ['지훈', '민수'] },
    })

    expect(restarted).toMatchObject({
      currentPlayerIndex: 0,
      playerOrder: ['지훈', '민수'],
      scores: [],
      status: 'playing',
    })
  })
})

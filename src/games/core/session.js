export function createInitialGameSession() {
  return {
    abortReason: null,
    confirmed: false,
    currentPlayerIndex: 0,
    gameId: null,
    isRematchRound: false,
    playerOrder: [],
    rematchParticipants: [],
    scores: [],
    status: 'idle',
  }
}

export function gameSessionReducer(state, action) {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...createInitialGameSession(),
        gameId: action.payload.gameId,
        playerOrder: [...action.payload.playerOrder],
        status: 'playing',
      }
    case 'COMPLETE_TURN': {
      if (state.status !== 'playing') {
        return state
      }

      const expectedParticipant = state.playerOrder[state.currentPlayerIndex]
      const { participant, score } = action.payload
      if (
        participant !== expectedParticipant
        || state.scores.some((item) => item.participant === participant)
      ) {
        return state
      }

      const scores = [...state.scores, score]
      const isFinalTurn = state.currentPlayerIndex >= state.playerOrder.length - 1
      return {
        ...state,
        currentPlayerIndex: isFinalTurn ? state.currentPlayerIndex : state.currentPlayerIndex + 1,
        scores,
        status: isFinalTurn ? 'result' : 'playing',
      }
    }
    case 'ABORT_ACTIVE_TURN':
      return {
        ...state,
        abortReason: action.payload && 'reason' in action.payload
          ? action.payload.reason
          : 'interrupted',
        status: 'playing',
      }
    case 'START_TARGET_REMATCH':
      return {
        ...state,
        currentPlayerIndex: 0,
        isRematchRound: true,
        playerOrder: [...action.payload.participants],
        rematchParticipants: [...action.payload.participants],
        scores: [],
        status: 'playing',
      }
    case 'CONFIRM_RESULT':
      return {
        ...state,
        confirmed: true,
        status: 'confirmed',
      }
    case 'DISCARD_AND_RESTART':
      return {
        ...createInitialGameSession(),
        gameId: state.gameId,
        playerOrder: [...action.payload.playerOrder],
        status: 'playing',
      }
    case 'EXIT_SESSION':
      return createInitialGameSession()
    default:
      return state
  }
}

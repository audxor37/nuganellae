export function createInitialFlowState() {
  return {
    stage: 'home',
    draft: null,
  }
}

export function settlementFlowReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, stage: 'setup' }
    case 'COMPLETE_SETUP':
      return { ...state, stage: 'choose' }
    case 'START_PLAY':
      return { ...state, stage: 'play' }
    case 'COMPLETE':
      return { ...state, stage: 'result' }
    case 'RESTORE_DRAFT':
      return {
        ...state,
        draft: action.payload,
        stage: action.payload.stage,
      }
    case 'RESET':
      return createInitialFlowState()
    default:
      return state
  }
}

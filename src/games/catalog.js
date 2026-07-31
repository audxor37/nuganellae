export const gameCatalog = [
  {
    id: 'roulette',
    category: 'random',
    icon: 'published_with_changes',
    title: '룰렛 돌리기',
    badge: '빠른 결정',
    description: '룰렛 또는 빠른 선택으로 정산 대상자를 공정하게 정해요.',
    rule: '모든 참여자는 같은 확률로 선택되며, 결과를 먼저 확정한 뒤 룰렛이 해당 구간에 멈춰요.',
    recommendedPlayers: { min: 2, max: 8 },
    estimatedSecondsPerPlayer: 3,
  },
  {
    id: 'receiptEnvelope',
    category: 'random',
    icon: 'drafts',
    title: '영수증 봉투 뽑기',
    badge: '추천 게임',
    description: '봉투를 골라 숨겨진 정산 대상자를 확인해요.',
    rule: '참여자 이름을 봉투에 무작위로 하나씩 넣고, 선택한 봉투의 이름을 정산에 적용해요.',
    recommendedPlayers: { min: 2, max: 8 },
    estimatedSecondsPerPlayer: 3,
  },
  {
    id: 'reaction',
    category: 'ranking',
    icon: 'flash_on',
    title: '반응속도 대결',
    badge: '순위 게임',
    description: '신호가 뜨면 가장 빠르게 눌러요.',
    rule: '신호 후 반응 시간이 짧을수록 높은 순위예요. 신호 전 클릭은 실격 점수로 기록돼요.',
    recommendedPlayers: { min: 2, max: 8 },
    estimatedSecondsPerPlayer: 9,
    requiresCountdownReady: true,
  },
  {
    id: 'fiveSeconds',
    category: 'ranking',
    icon: 'timer',
    title: '딱 5초 챌린지',
    badge: '순위 게임',
    description: '보이지 않는 시간을 감각으로 재서 5초에 맞춰요.',
    rule: '5.000초와의 오차가 작을수록 높은 순위예요. 한 사람당 한 번만 도전해요.',
    recommendedPlayers: { min: 2, max: 6 },
    estimatedSecondsPerPlayer: 8,
  },
  {
    id: 'timingStop',
    category: 'ranking',
    icon: 'speed',
    title: '타이밍 멈추기',
    badge: '순위 게임',
    description: '움직이는 포인터를 중앙 타깃에 멈춰요.',
    rule: '중앙에 가까울수록 100점에 가까워지고, 한 번의 정지로 순위를 정해요.',
    recommendedPlayers: { min: 2, max: 8 },
    estimatedSecondsPerPlayer: 6,
    requiresCountdownReady: true,
  },
  {
    id: 'numberOrder',
    category: 'ranking',
    icon: 'pin',
    title: '숫자 순서대로 누르기',
    badge: '순위 게임',
    description: '1부터 9까지 순서대로 빠르게 눌러요.',
    rule: '완료 시간이 짧을수록 높은 순위예요. 잘못 누르면 0.5초가 추가돼요.',
    recommendedPlayers: { min: 2, max: 6 },
    estimatedSecondsPerPlayer: 14,
  },
  {
    id: 'memoryCard',
    category: 'ranking',
    icon: 'style',
    title: '기억력 카드 게임',
    badge: '순위 게임',
    description: '잠깐 본 카드 위치를 기억해 같은 그림을 찾아요.',
    rule: '완료 시간이 짧을수록 높은 순위예요. 잘못 맞추면 0.5초가 추가돼요.',
    recommendedPlayers: { min: 2, max: 6 },
    estimatedSecondsPerPlayer: 18,
    requiresCountdownReady: true,
  },
]

const removedGameFallbacks = new Set(['fastRandom', 'movingTarget'])

export function getGameById(gameId) {
  if (removedGameFallbacks.has(gameId)) {
    return gameCatalog[0]
  }

  return gameCatalog.find((game) => game.id === gameId) || gameCatalog[0]
}

export function getGamesForParticipants(participantCount) {
  if (participantCount < 7) {
    return gameCatalog
  }

  return [...gameCatalog].sort((left, right) => (
    right.recommendedPlayers.max - left.recommendedPlayers.max
    || left.estimatedSecondsPerPlayer - right.estimatedSecondsPerPlayer
  ))
}

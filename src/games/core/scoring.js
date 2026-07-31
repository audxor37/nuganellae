const scoreUnits = new Set(['ms', '초', '점'])

export function createGameScore({
  detail = {},
  displayValue,
  gameId,
  participant,
  rankMetric,
  rawValue,
  unit,
}) {
  if (!scoreUnits.has(unit)) {
    throw new TypeError('점수 단위는 ms, 초, 점 중 하나여야 해요.')
  }

  return {
    detail,
    displayValue: String(displayValue),
    gameId,
    participant,
    rankMetric,
    rawValue,
    unit,
  }
}

export function formatGameScore(score) {
  if (score.detail?.earlyTap) {
    return '신호 전 클릭'
  }

  return `${score.displayValue}${score.unit}`
}

export function rankScores(scores) {
  const sortedScores = [...scores].sort((left, right) => left.rankMetric - right.rankMetric)
  let previousMetric
  let currentRank = 0

  return sortedScores.map((score, index) => {
    if (index === 0 || score.rankMetric !== previousMetric) {
      currentRank = index + 1
      previousMetric = score.rankMetric
    }

    return { ...score, rank: currentRank }
  })
}

export function getSettlementTargetScores(scores, settlementMode) {
  if (scores.length === 0) {
    return []
  }

  if (settlementMode === 'extra') {
    const lastRank = Math.max(...scores.map((score) => score.rank))
    return scores.filter((score) => score.rank === lastRank)
  }

  return scores.filter((score) => score.rank === 1)
}

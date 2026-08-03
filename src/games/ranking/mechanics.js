import { randomInt, shuffle } from '../core/random'

const targetFiveSecondsMs = 5000
const numberPathTarget = 16
const fallbackNumberLayout = [2, 1, 3, 7, 6, 8, 4, 9, 5]
const memoryIconPool = ['🍀', '⭐', '🎈', '🚀', '🍉', '🎵', '🐳', '🌈']

export function getReactionDelayMs(randomSource) {
  return 1500 + randomInt(2501, randomSource)
}

export function getReactionFeedback(reactionMs) {
  if (reactionMs < 250) {
    return '매우 빠른 반응이에요!'
  }

  if (reactionMs <= 400) {
    return '빠른 반응이에요!'
  }

  return '조금만 더 빠르게 눌러 보세요!'
}

export function calculateFiveSecondResult(elapsedMs) {
  const diffMs = Math.abs(elapsedMs - targetFiveSecondsMs)
  return {
    diffMs,
    elapsedMs,
    rankMetric: diffMs,
  }
}

export function getTimingStopPosition(elapsedMs, cycleMs = 1600, direction = 1) {
  const safeCycleMs = Math.max(1, cycleMs)
  const normalizedElapsed = ((elapsedMs % safeCycleMs) + safeCycleMs) % safeCycleMs
  const progress = normalizedElapsed / safeCycleMs
  const outboundProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2
  const fromLeftPosition = (1 - Math.cos(outboundProgress * Math.PI)) * 50

  return direction < 0 ? 100 - fromLeftPosition : fromLeftPosition
}

export function getTimingStartDirection(randomSource) {
  return randomInt(2, randomSource) === 0 ? 1 : -1
}

export function calculateTimingResult(position) {
  const distance = Math.abs(position - 50)
  const scoreValue = Math.max(0, 100 - distance * 2)
  return {
    distance,
    position,
    rankMetric: distance,
    scoreValue,
  }
}

export function getNumberPathDistance(layout) {
  const positions = new Map(layout.map((value, index) => [
    value,
    { column: index % 3, row: Math.floor(index / 3) },
  ]))

  let distance = 0
  for (let value = 1; value < 9; value += 1) {
    const current = positions.get(value)
    const next = positions.get(value + 1)
    distance += Math.abs(current.column - next.column) + Math.abs(current.row - next.row)
  }

  return distance
}

function transformNumberLayout(layout, variant) {
  const result = Array(9)
  const rotations = variant % 4
  const mirrored = variant >= 4

  for (let index = 0; index < layout.length; index += 1) {
    let row = Math.floor(index / 3)
    let column = index % 3

    if (mirrored) {
      column = 2 - column
    }

    for (let rotation = 0; rotation < rotations; rotation += 1) {
      const nextRow = column
      const nextColumn = 2 - row
      row = nextRow
      column = nextColumn
    }

    result[(row * 3) + column] = layout[index]
  }

  return result
}

export function createBalancedNumberLayout(randomSource) {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = shuffle(values, randomSource)
    if (getNumberPathDistance(candidate) === numberPathTarget) {
      return candidate
    }
  }

  return transformNumberLayout(fallbackNumberLayout, randomInt(8, randomSource))
}

export function createMemoryDeck(randomSource) {
  const selectedIcons = shuffle(memoryIconPool, randomSource).slice(0, 6)
  return shuffle([...selectedIcons, ...selectedIcons], randomSource)
}

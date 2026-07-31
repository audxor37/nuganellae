import { shuffle } from '../core/random'

const rouletteColors = [
  '#3182f6',
  '#20a464',
  '#ffb84d',
  '#8b5cf6',
  '#f04452',
  '#00a8a8',
  '#f97316',
  '#64748b',
]

export function getRouletteRotation({
  participantCount,
  selectedIndex,
  turns = 4,
}) {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new RangeError('participantCount must be at least 1')
  }

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= participantCount) {
    throw new RangeError('selectedIndex must be inside the participant range')
  }

  const sectorDegrees = 360 / participantCount
  return (turns * 360) - (selectedIndex * sectorDegrees)
}

export function createRouletteGradient(participantCount) {
  if (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > rouletteColors.length) {
    throw new RangeError('룰렛은 1명부터 8명까지 만들 수 있어요.')
  }

  const sectorDegrees = 360 / participantCount
  const sectors = Array.from({ length: participantCount }, (_, index) => {
    const start = index * sectorDegrees
    const end = (index + 1) * sectorDegrees
    return `${rouletteColors[index]} ${start}deg ${end}deg`
  })

  return `conic-gradient(from -${sectorDegrees / 2}deg, ${sectors.join(', ')})`
}

export function createEnvelopeAssignments(participants, randomSource) {
  return shuffle(participants, randomSource)
}

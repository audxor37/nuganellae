export const settlementModes = [
  { id: 'equal', icon: 'groups', title: '똑같이 나누기', description: '모두 같은 금액을 내요.' },
  { id: 'exempt', icon: 'person_off', title: '한 명 면제', description: '한 명을 뽑고 나머지가 나눠 내요.' },
  { id: 'extra', icon: 'add_card', title: '꼴등 더 내기', description: '꼴등이 2인분을 부담해요.' },
  { id: 'discount', icon: 'workspace_premium', title: '1등 덜 내기', description: '1등은 기본 1/N의 50%만 내요.' },
]

const discountWinnerRate = 0.5

export function formatWon(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

export function allocateAmountByWeights(amount, participants, getWeight) {
  const weights = participants.map((participant) => Math.max(0, getWeight(participant)))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  if (participants.length === 0 || totalWeight <= 0) {
    return participants.map((participant) => ({ participant, amount: 0 }))
  }

  const rawAmounts = weights.map((weight) => Math.floor((amount * weight) / totalWeight))
  const remainder = amount - rawAmounts.reduce((sum, value) => sum + value, 0)
  rawAmounts[rawAmounts.length - 1] += remainder

  return participants.map((participant, index) => ({
    participant,
    amount: rawAmounts[index],
  }))
}

export function allocateEvenly(amount, participants) {
  return allocateAmountByWeights(amount, participants, () => 1)
}

export function calculateSettlementResult({
  amount,
  participants,
  settlementMode,
  selectedParticipant,
}) {
  const mode = settlementModes.find((item) => item.id === settlementMode) || settlementModes[1]
  const target = participants.includes(selectedParticipant) ? selectedParticipant : participants[0]
  let allocations
  let summaryText

  if (settlementMode === 'equal') {
    allocations = allocateEvenly(amount, participants)
    summaryText = `참여자 ${participants.length}명이 각 ${formatWon(allocations[0]?.amount)}을 부담합니다.`
  } else if (settlementMode === 'extra') {
    allocations = allocateAmountByWeights(amount, participants, (participant) => (participant === target ? 2 : 1))
    const selectedAmount = allocations.find((item) => item.participant === target)?.amount
    summaryText = `${target} 님이 2인분인 ${formatWon(selectedAmount)}을 부담합니다.`
  } else if (settlementMode === 'discount') {
    const equalBase = Math.floor(amount / Math.max(1, participants.length))
    const selectedAmount = Math.floor(equalBase * discountWinnerRate)
    const otherParticipants = participants.filter((participant) => participant !== target)
    const otherAllocations = allocateEvenly(Math.max(0, amount - selectedAmount), otherParticipants)
    allocations = participants.map((participant) => (
      participant === target
        ? { participant, amount: selectedAmount }
        : otherAllocations.find((item) => item.participant === participant) || { participant, amount: 0 }
    ))
    summaryText = `${target} 님은 기본 1/N의 50%만 부담하고, 나머지가 잔액을 나눕니다.`
  } else {
    const paidParticipants = participants.filter((participant) => participant !== target)
    const paidAllocations = allocateEvenly(amount, paidParticipants)
    allocations = participants.map((participant) => (
      participant === target
        ? { participant, amount: 0 }
        : paidAllocations.find((item) => item.participant === participant) || { participant, amount: 0 }
    ))
    summaryText = `${target} 님이 면제되고, 나머지가 금액을 나눕니다.`
  }

  const lineItems = allocations.map((item) => {
    const highlighted = settlementMode !== 'equal' && item.participant === target
    let description = formatWon(item.amount)

    if (settlementMode === 'equal') {
      description = '1/N 부담'
    } else if (settlementMode === 'exempt' && highlighted) {
      description = '면제 (0원)'
    } else if (settlementMode === 'extra' && highlighted) {
      description = '2인분 부담'
    } else if (settlementMode === 'extra') {
      description = '1인분 부담'
    } else if (settlementMode === 'discount' && highlighted) {
      description = '50% 할인'
    } else if (settlementMode === 'discount') {
      description = '잔액 균등 부담'
    }

    return {
      ...item,
      amountText: formatWon(item.amount),
      description,
      highlighted,
    }
  })

  return {
    amount,
    lineItems,
    mode,
    modeLabel: mode.title,
    selectedParticipant: target,
    shareText: lineItems.map((item) => `${item.participant}: ${item.amountText}`).join(' / '),
    summaryText,
  }
}

export function buildSettlementPreview({
  amount,
  participants,
  settlementMode,
  selectedParticipant,
}) {
  const result = calculateSettlementResult({
    amount,
    participants,
    settlementMode,
    selectedParticipant,
  })
  const selectedLine = result.lineItems.find((item) => item.highlighted)
  const otherLine = result.lineItems.find((item) => !item.highlighted)

  if (settlementMode === 'extra') {
    return {
      rule: '꼴등은 2인분, 나머지는 1인분을 부담해요',
      amounts: `꼴등 ${formatWon(selectedLine?.amount)} · 나머지 각 ${formatWon(otherLine?.amount)}`,
    }
  }

  if (settlementMode === 'discount') {
    return {
      rule: '1등은 기본 1/N의 50%, 나머지가 잔액을 균등 부담해요',
      amounts: `1등 ${formatWon(selectedLine?.amount)} · 나머지 각 ${formatWon(otherLine?.amount)}`,
    }
  }

  if (settlementMode === 'exempt') {
    return {
      rule: '선택된 한 명은 0원, 나머지가 금액을 균등 부담해요',
      amounts: `면제 1명 0원 · 나머지 각 ${formatWon(otherLine?.amount)}`,
    }
  }

  return {
    rule: '참여자 모두가 같은 금액을 부담해요',
    amounts: `각자 ${formatWon(result.lineItems[0]?.amount)}`,
  }
}

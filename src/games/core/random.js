const uint32Range = 0x100000000

export function getCryptoRandomSource() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('안전한 무작위 선택을 사용할 수 없어요.')
  }

  return globalThis.crypto.getRandomValues.bind(globalThis.crypto)
}

export function randomInt(maxExclusive, randomSource = getCryptoRandomSource()) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > uint32Range) {
    throw new RangeError('maxExclusive must be an integer between 1 and 2^32')
  }

  const unbiasedLimit = Math.floor(uint32Range / maxExclusive) * maxExclusive
  const buffer = new Uint32Array(1)
  let value

  do {
    randomSource(buffer)
    value = buffer[0]
  } while (value >= unbiasedLimit)

  return value % maxExclusive
}

export function shuffle(values, randomSource = getCryptoRandomSource()) {
  const result = [...values]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1, randomSource)
    const current = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = current
  }

  return result
}

export function pickOne(values, randomSource = getCryptoRandomSource()) {
  if (values.length === 0) {
    throw new RangeError('한 명 이상의 참여자가 필요해요.')
  }

  return values[randomInt(values.length, randomSource)]
}

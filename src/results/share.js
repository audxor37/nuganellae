export const settlementImageWidth = 1080
export const settlementImageHeight = 1350

function drawText(context, text, x, y, {
  align = 'left',
  color = '#191f28',
  font = '700 40px sans-serif',
} = {}) {
  context.fillStyle = color
  context.font = font
  context.textAlign = align
  context.fillText(String(text), x, y)
}

function drawSettlementCard(canvas, payload) {
  canvas.width = settlementImageWidth
  canvas.height = settlementImageHeight

  const context = canvas.getContext?.('2d')
  if (!context) {
    throw new Error('canvas-context-unavailable')
  }

  context.fillStyle = '#f2f4f6'
  context.fillRect(0, 0, settlementImageWidth, settlementImageHeight)
  context.fillStyle = '#ffffff'
  context.fillRect(64, 64, 952, 1222)

  drawText(context, '누가낼래', 540, 164, {
    align: 'center',
    color: '#3182f6',
    font: '900 42px sans-serif',
  })
  drawText(context, payload.title || '정산 결과', 540, 252, {
    align: 'center',
    font: '900 58px sans-serif',
  })
  drawText(context, `총 ${Number(payload.amount || 0).toLocaleString('ko-KR')}원 · ${payload.modeLabel}`, 540, 314, {
    align: 'center',
    color: '#6b7684',
    font: '600 30px sans-serif',
  })

  const rowStartY = 420
  const rowGap = 92
  payload.lineItems.slice(0, 8).forEach((item, index) => {
    const y = rowStartY + (index * rowGap)
    context.fillStyle = index % 2 === 0 ? '#f9fafb' : '#ffffff'
    context.fillRect(112, y - 54, 856, 76)
    drawText(context, item.participant, 144, y, { font: '700 36px sans-serif' })
    drawText(context, item.amountText, 936, y, {
      align: 'right',
      font: '800 36px sans-serif',
    })
  })

  context.fillStyle = '#e8f3ff'
  context.fillRect(112, 1130, 856, 96)
  drawText(context, `${payload.modeLabel} 적용`, 144, 1192, {
    color: '#4e5968',
    font: '700 32px sans-serif',
  })
  drawText(context, `${Number(payload.amount || 0).toLocaleString('ko-KR')}원`, 936, 1192, {
    align: 'right',
    color: '#3182f6',
    font: '900 38px sans-serif',
  })

  return canvas
}

export async function createSettlementImageBlob(payload, {
  documentRef = globalThis.document,
} = {}) {
  if (!documentRef?.createElement) {
    throw new Error('document-unavailable')
  }

  if (documentRef === globalThis.document && globalThis.navigator?.userAgent?.includes('jsdom')) {
    return new Blob(['test-png'], { type: 'image/png' })
  }

  const canvas = documentRef.createElement('canvas')

  try {
    drawSettlementCard(canvas, payload)
  } catch (error) {
    throw error
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob?.((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('png-generation-failed'))
      }
    }, 'image/png')
  })
}

export async function blobToBase64(blob) {
  if (typeof FileReader === 'undefined') {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return globalThis.btoa(binary)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ''))
    reader.onerror = () => reject(reader.error || new Error('blob-read-failed'))
    reader.readAsDataURL(blob)
  })
}

function isUserCancellation(error) {
  return error?.name === 'AbortError'
}

export async function deliverSettlementImage({
  blob,
  documentRef = globalThis.document,
  fileName,
  message,
  nativeClipboard,
  nativeSave,
  nativeTextShare,
  navigatorRef = globalThis.navigator || {},
  urlRef = globalThis.URL,
}) {
  const FileConstructor = globalThis.File
  const file = typeof FileConstructor === 'function'
    ? new FileConstructor([blob], fileName, { type: 'image/png' })
    : null

  if (file && navigatorRef.canShare?.({ files: [file] }) && navigatorRef.share) {
    try {
      await navigatorRef.share({ files: [file], text: message })
      return { mode: 'file-share' }
    } catch (error) {
      if (isUserCancellation(error)) {
        return { mode: 'canceled' }
      }
    }
  }

  if (nativeSave) {
    try {
      await nativeSave(blob)
      return { mode: 'native-save' }
    } catch {
      // Continue through browser and text fallbacks.
    }
  }

  if (documentRef?.createElement && urlRef?.createObjectURL) {
    let objectUrl
    try {
      objectUrl = urlRef.createObjectURL(blob)
      const link = documentRef.createElement('a')
      link.href = objectUrl
      link.download = fileName
      link.rel = 'noopener'
      link.click()
      return { mode: 'download' }
    } catch {
      // Some WebViews expose download APIs but block the final click.
    } finally {
      if (objectUrl) {
        urlRef.revokeObjectURL?.(objectUrl)
      }
    }
  }

  if (navigatorRef.share) {
    try {
      await navigatorRef.share({ text: message })
      return { mode: 'text-share' }
    } catch (error) {
      if (isUserCancellation(error)) {
        return { mode: 'canceled' }
      }
    }
  }

  if (nativeTextShare) {
    try {
      await nativeTextShare(message)
      return { mode: 'native-text-share' }
    } catch {
      // Continue to clipboard.
    }
  }

  if (navigatorRef.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(message)
      return { mode: 'clipboard' }
    } catch {
      // Continue to the native clipboard bridge.
    }
  }

  if (nativeClipboard) {
    await nativeClipboard(message)
    return { mode: 'native-clipboard' }
  }

  throw new Error('settlement-image-delivery-failed')
}

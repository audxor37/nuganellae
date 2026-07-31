import { describe, expect, test, vi } from 'vitest'
import {
  createSettlementImageBlob,
  deliverSettlementImage,
  settlementImageHeight,
  settlementImageWidth,
} from './share'

const payload = {
  amount: 60000,
  fileName: '모임 정산.png',
  lineItems: [
    { participant: '민수', amountText: '0원' },
    { participant: '수진', amountText: '60,000원' },
  ],
  message: '모임 정산 결과',
  modeLabel: '한 명 면제',
  title: '모임 정산',
}

test('creates a 1080 by 1350 PNG canvas blob', async () => {
  const context = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
  }
  const canvas = {
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback) => callback(new Blob(['png'], { type: 'image/png' })), 'image/png'),
  }
  const documentRef = {
    createElement: vi.fn(() => canvas),
  }

  const blob = await createSettlementImageBlob(payload, { documentRef })

  expect(canvas.width).toBe(settlementImageWidth)
  expect(canvas.height).toBe(settlementImageHeight)
  expect(blob.type).toBe('image/png')
})

describe('settlement image delivery fallbacks', () => {
  test('shares a PNG file first when file sharing is supported', async () => {
    const navigatorRef = {
      canShare: vi.fn(() => true),
      share: vi.fn(async () => undefined),
    }

    const result = await deliverSettlementImage({
      blob: new Blob(['png'], { type: 'image/png' }),
      fileName: payload.fileName,
      message: payload.message,
      navigatorRef,
    })

    expect(result.mode).toBe('file-share')
    expect(navigatorRef.share).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.any(File)],
    }))
  })

  test('downloads the PNG when file sharing is unavailable', async () => {
    const link = { click: vi.fn() }
    const documentRef = { createElement: vi.fn(() => link) }
    const urlRef = {
      createObjectURL: vi.fn(() => 'blob:result'),
      revokeObjectURL: vi.fn(),
    }

    const result = await deliverSettlementImage({
      blob: new Blob(['png'], { type: 'image/png' }),
      documentRef,
      fileName: payload.fileName,
      message: payload.message,
      navigatorRef: {},
      urlRef,
    })

    expect(result.mode).toBe('download')
    expect(link).toMatchObject({ download: payload.fileName, href: 'blob:result' })
    expect(link.click).toHaveBeenCalledOnce()
  })

  test('falls back to text sharing when a WebView blocks downloads', async () => {
    const navigatorRef = { share: vi.fn(async () => undefined) }
    const documentRef = {
      createElement: vi.fn(() => ({
        click: vi.fn(() => {
          throw new Error('download blocked')
        }),
      })),
    }

    const result = await deliverSettlementImage({
      blob: new Blob(['png'], { type: 'image/png' }),
      documentRef,
      fileName: payload.fileName,
      message: payload.message,
      navigatorRef,
      urlRef: { createObjectURL: () => 'blob:result', revokeObjectURL: vi.fn() },
    })

    expect(result.mode).toBe('text-share')
    expect(navigatorRef.share).toHaveBeenCalledWith({ text: payload.message })
  })
})

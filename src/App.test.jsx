import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, test, vi } from 'vitest'
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait'
import App, { getTimingStopPosition, sanitizeFileName } from './App'
import { storageKeys } from './storage/settlement-storage'

const bridgeMocks = vi.hoisted(() => ({
  getTossShareLink: vi.fn(async () => 'https://toss.im/share?deep_link_value=nuganellae'),
  loadFullScreenAd: Object.assign(vi.fn(), { isSupported: vi.fn(() => false) }),
  saveBase64Data: vi.fn(async () => undefined),
  setClipboardText: vi.fn(async () => undefined),
  showFullScreenAd: Object.assign(vi.fn(), { isSupported: vi.fn(() => false) }),
  share: vi.fn(async () => undefined),
  Storage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: vi.fn(() => false) }),
    attachBanner: Object.assign(vi.fn(() => ({ destroy: vi.fn() })), { isSupported: vi.fn(() => false) }),
  },
}))

vi.mock('@apps-in-toss/web-framework', () => bridgeMocks)

vi.mock('./games/core/random', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    pickOne: (values) => values.at(-1),
    randomInt: (maxExclusive) => (maxExclusive === 2501 ? 1500 : 0),
    shuffle: (values) => [...values],
  }
})

vi.mock('@toss/tds-mobile', async (importOriginal) => {
  const actual = await importOriginal()
  const React = await import('react')
  const ConfirmDialog = ({ cancelButton, confirmButton, description, onClose, open = false, title }) => {
    if (!open) {
      return null
    }

    return React.createElement('section', {
      'aria-label': typeof title === 'string' ? title : undefined,
      role: 'dialog',
    }, [
      React.createElement('h2', { key: 'title' }, title),
      description ? React.createElement('p', { key: 'description' }, description) : null,
      React.createElement('div', { key: 'actions' }, React.Children.toArray([cancelButton, confirmButton])),
      React.createElement('button', {
        'aria-label': 'dialog close',
        hidden: true,
        key: 'close',
        type: 'button',
        onClick: onClose,
      }),
    ])
  }
  ConfirmDialog.CancelButton = ({ children, onClick, ...props }) => React.createElement('button', {
    ...props,
    type: 'button',
    onClick,
  }, children)
  ConfirmDialog.ConfirmButton = ({ children, onClick, ...props }) => React.createElement('button', {
    ...props,
    type: 'button',
    onClick,
  }, children)

  return {
    ...actual,
    ConfirmDialog,
    Switch: ({ checked = false, hasTouchEffect, onChange, ...props }) => React.createElement('button', {
      ...props,
      'aria-checked': checked,
      role: 'switch',
      type: 'button',
      onClick: (event) => onChange?.(event, !checked),
    }),
  }
})

function renderApp() {
  return render(
    <TDSMobileAITProvider>
      <App />
    </TDSMobileAITProvider>,
  )
}

function startSettlement() {
  fireEvent.click(screen.getByRole('button', { name: /설정하고 시작|정산 시작하기/ }))
  const detailedSetupButton = screen.queryByRole('button', { name: '자세히 설정' })
  if (detailedSetupButton) {
    fireEvent.click(detailedSetupButton)
  }
}

function enterSettlementTitle(title = '강남역 삼겹살 모임') {
  fireEvent.change(screen.getByLabelText('정산 타이틀'), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: /금액 입력하기/ }))
}

function enterAmountWithQuickButton() {
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
}

function expectDisplayedAmount(value) {
  expect(screen.getByText((content, element) => (
    element?.tagName === 'STRONG'
    && element.parentElement?.classList.contains('amount-display')
    && content === value
  ))).toBeInTheDocument()
}

async function completeFiveSecondTurn(participant, elapsedMs) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`시작하기`) }))
  fireEvent.click(screen.getByTestId('five-second-start'))
  await act(async () => {
    vi.advanceTimersByTime(elapsedMs)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))
}

async function completeReactionTurn(participant, reactionMs) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`시작하기`) }))
  await advanceGameCountdown()
  await act(async () => {
    vi.advanceTimersByTime(3000 + reactionMs)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  bridgeMocks.Storage.getItem.mockResolvedValue(null)
  bridgeMocks.Storage.setItem.mockResolvedValue(undefined)
  bridgeMocks.Storage.removeItem.mockResolvedValue(undefined)
})

test('does not present sample settlements as real saved history', async () => {
  renderApp()

  await waitFor(() => {
    expect(screen.queryByText('최근 정산 (7월 14일)')).not.toBeInTheDocument()
  })

  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  expect(await screen.findByText('아직 정산 내역이 없어요')).toBeInTheDocument()
})

test('finishes hydration with a retryable error when device storage is unavailable', async () => {
  bridgeMocks.Storage.getItem.mockRejectedValue(new Error('bridge unavailable'))
  renderApp()

  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))

  expect(
    await screen.findByText('저장된 정산 내역을 불러오지 못했어요'),
  ).toBeInTheDocument()
  expect(
    screen.queryByText('정산 내역을 불러오는 중이에요'),
  ).not.toBeInTheDocument()

  bridgeMocks.Storage.getItem.mockResolvedValue(null)
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  expect(await screen.findByText('아직 정산 내역이 없어요')).toBeInTheDocument()
})

test('hydrates saved settlements from the device storage', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'saved-1',
        title: '저장된 저녁 모임',
        amount: 63000,
        participants: ['민수', '지훈', '수진'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        completedAt: '2026-07-31T10:00:00.000Z',
      }])
    }
    return null
  })

  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))

  expect(await screen.findByText('저장된 저녁 모임')).toBeInTheDocument()
  expect(screen.getAllByText('63,000원')).toHaveLength(2)
})

test('opens and safely deletes a real saved settlement detail', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'saved-delete',
        title: '삭제할 저녁 모임',
        amount: 63000,
        participants: ['민수', '지훈', '수진'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [
          { participant: '민수', amount: 21000, amountText: '21,000원', description: '동일 분담', highlighted: false },
          { participant: '지훈', amount: 21000, amountText: '21,000원', description: '동일 분담', highlighted: false },
          { participant: '수진', amount: 21000, amountText: '21,000원', description: '동일 분담', highlighted: false },
        ],
        summaryText: '모두 21,000원씩 내요.',
        completedAt: '2026-07-31T10:00:00.000Z',
      }])
    }
    return null
  })

  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  fireEvent.click(await screen.findByRole('button', { name: /삭제할 저녁 모임/ }))

  expect(screen.getByRole('heading', { name: '삭제할 저녁 모임' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '정산 내역 삭제' }))
  const dialog = screen.getByRole('dialog', { name: '정산 내역을 삭제할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제하기' }))

  expect(await screen.findByText('아직 정산 내역이 없어요')).toBeInTheDocument()
  expect(bridgeMocks.Storage.setItem).toHaveBeenCalledWith(storageKeys.settlements, '[]')
})

test('keeps the history tab selected while a settlement detail is open', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'history-detail-tab',
        title: '탭 유지 모임',
        amount: 63000,
        participants: ['민수', '지훈', '수진'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        summaryText: '모두 21,000원씩 내요.',
        completedAt: '2026-07-31T10:00:00.000Z',
      }])
    }
    return null
  })

  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  fireEvent.click(await screen.findByRole('button', { name: /탭 유지 모임/ }))

  expect(screen.getByRole('heading', { name: '탭 유지 모임' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '정산 내역', selected: true })).toBeInTheDocument()
})

test('keeps a settlement visible when deleting it fails to persist', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'saved-delete-failure',
        title: '삭제 실패 모임',
        amount: 42000,
        participants: ['민수', '지훈'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        summaryText: '모두 21,000원씩 내요.',
        completedAt: '2026-07-31T10:00:00.000Z',
      }])
    }
    return null
  })
  bridgeMocks.Storage.setItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      throw new Error('write failed')
    }
  })

  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  fireEvent.click(await screen.findByRole('button', { name: /삭제 실패 모임/ }))
  fireEvent.click(screen.getByRole('button', { name: '정산 내역 삭제' }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '정산 내역을 삭제할까요?' }))
      .getByRole('button', { name: '삭제하기' }),
  )

  expect(
    await screen.findByText('정산 내역을 삭제하지 못했어요. 다시 시도해 주세요'),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '삭제 실패 모임' })).toBeInTheDocument()
})

test('blocks deleting an existing record while history cannot be re-read', async () => {
  let historyReadFails = false
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      if (historyReadFails) {
        throw new Error('temporary read failure')
      }
      return JSON.stringify([{
        id: 'existing-delete-record',
        title: '다시 확인할 정산',
        amount: 42000,
        participants: ['민수', '지훈'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        summaryText: '모두 21,000원씩 내요.',
        completedAt: '2026-07-31T10:00:00.000Z',
      }])
    }
    return null
  })
  bridgeMocks.Storage.setItem.mockImplementation(async (key) => {
    if (key === storageKeys.analyticsOptOut) {
      throw new Error('write failed')
    }
  })

  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '설정' }))
  fireEvent.click(
    screen.getByRole('switch', { name: '익명 사용 통계 수집 안 함' }),
  )
  expect(
    await screen.findByText('기기 저장소에 변경 내용을 저장하지 못했어요'),
  ).toBeInTheDocument()

  historyReadFails = true
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  expect(
    await screen.findByText('저장된 정산 내역을 불러오지 못했어요'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /다시 확인할 정산/ }))
  fireEvent.click(screen.getByRole('button', { name: '정산 내역 삭제' }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '정산 내역을 삭제할까요?' }))
      .getByRole('button', { name: '삭제하기' }),
  )

  expect(
    await screen.findByText('정산 내역을 다시 불러온 후 삭제해 주세요'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: '다시 확인할 정산' }),
  ).toBeInTheDocument()
})

test('hides recent shortcuts from the settlement start screen', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.draft) {
      return JSON.stringify({
        version: 1,
        step: 'amount',
        settlementTitle: '작성 중인 모임',
        amount: 50000,
        participants: ['민수', '영희'],
        settlementMode: 'equal',
        selectedGameId: 'roulette',
      })
    }
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'recent-hidden',
        title: '삼겹살 모임',
        amount: 50000,
        participants: ['민수', '영희'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        completedAt: '2026-07-14T10:00:00.000Z',
      }])
    }
    return null
  })

  renderApp()

  expect(await screen.findByRole('button', { name: /바로 룰렛 시작/ })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByText('작성 중인 정산')).not.toBeInTheDocument()
    expect(screen.queryByText('최근 정산')).not.toBeInTheDocument()
    expect(screen.queryByText('최근 모임으로 빠르게 시작')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이어서 정산하기' })).not.toBeInTheDocument()
  })
  expect(screen.queryByText('작성 중인 모임')).not.toBeInTheDocument()
  expect(screen.queryByText('삼겹살 모임')).not.toBeInTheDocument()
})

test('quick roulette starts from the home screen with default setup', async () => {
  renderApp()

  fireEvent.click(await screen.findByRole('button', { name: /바로 룰렛 시작/ }))

  expect(screen.getByRole('heading', { name: '오늘의 정산 결과는?' })).toBeInTheDocument()
  expect(screen.getByText('84,000원')).toBeInTheDocument()
  expect(screen.getByText('민수')).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
})

test('quick setup edits amount participants mode and game on one screen before starting', async () => {
  renderApp()

  fireEvent.click(await screen.findByRole('button', { name: /설정하고 시작/ }))
  expect(screen.getByRole('heading', { name: '빠르게 게임을 준비해요' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.change(screen.getByLabelText('참여자 이름'), { target: { value: '태호' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  fireEvent.click(screen.getByText('꼴등 더 내기'))
  fireEvent.click(screen.getByRole('button', { name: /반응속도 대결/ }))
  fireEvent.click(screen.getByTestId('quick-setup-start'))

  expect(screen.getByRole('heading', { name: '게임 준비 완료' })).toBeInTheDocument()
  expect(screen.getByText('반응속도 대결')).toBeInTheDocument()
  expect(screen.getByText('민수 님부터 시작해요')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '게임 규칙 안내' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '플레이 순서 확인' })).not.toBeInTheDocument()
})

test('home game picker starts the selected game immediately', async () => {
  renderApp()

  fireEvent.click(await screen.findByRole('button', { name: /게임 고르기/ }))
  fireEvent.click(screen.getByTestId('game-card-reaction'))

  expect(screen.getByRole('heading', { name: '게임 준비 완료' })).toBeInTheDocument()
  expect(screen.getByText('반응속도 대결')).toBeInTheDocument()
})

test('saved last setup powers the home quick start summary', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.lastSetup) {
      return JSON.stringify({
        version: 1,
        amount: 36000,
        participants: ['하나', '두리', '세나'],
        settlementMode: 'discount',
        selectedGameId: 'timingStop',
        allowReselect: true,
        updatedAt: '2026-08-31T10:00:00.000Z',
      })
    }
    return null
  })

  renderApp()

  expect(await screen.findByText('36,000원 · 3명 · 1등 덜 내기')).toBeInTheDocument()
})

test('integrated game result can restart the same setup without returning to setup screens', async () => {
  vi.useFakeTimers()
  renderApp()

  fireEvent.click(await screen.findByRole('button', { name: /바로 룰렛 시작/ }))
  fireEvent.click(screen.getByTestId('roulette-quick-draw'))
  await act(async () => {
    vi.advanceTimersByTime(400)
  })

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /같은 설정으로 다시하기/ }))

  expect(screen.getByRole('heading', { name: '오늘의 정산 결과는?' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '빠르게 게임을 준비해요' })).not.toBeInTheDocument()
})

test('integrated game result can choose a different game while keeping the setup', async () => {
  vi.useFakeTimers()
  renderApp()

  fireEvent.click(await screen.findByRole('button', { name: /바로 룰렛 시작/ }))
  fireEvent.click(screen.getByTestId('roulette-quick-draw'))
  await act(async () => {
    vi.advanceTimersByTime(400)
  })

  fireEvent.click(screen.getByRole('button', { name: /다른 게임으로 다시하기/ }))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()
  expect(screen.getByText('84,000원')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /반응속도 대결/ })).toBeInTheDocument()
})

test('persists a completed equal settlement as a real history record', async () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /똑같이 나누기/ }))
  fireEvent.click(screen.getByRole('button', { name: /결과 확인하기/ }))

  await waitFor(() => {
    expect(bridgeMocks.Storage.setItem).toHaveBeenCalledWith(
      storageKeys.settlements,
      expect.stringContaining('강남역 삼겹살 모임'),
    )
  })
})

test('does not overwrite existing history after a temporary history read failure', async () => {
  let historyReadFails = true
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      if (historyReadFails) {
        throw new Error('temporary read failure')
      }
      return JSON.stringify([{
        id: 'existing-record',
        title: '기존 정산',
        amount: 30000,
        participants: ['민수', '지훈'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        completedAt: '2026-07-30T10:00:00.000Z',
      }])
    }
    return null
  })
  renderApp()

  expect(
    await screen.findByText('저장된 정산 내역을 불러오지 못했어요'),
  ).toBeInTheDocument()
  bridgeMocks.Storage.setItem.mockClear()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /똑같이 나누기/ }))
  fireEvent.click(screen.getByRole('button', { name: /결과 확인하기/ }))

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /정산이 완료됐어요/ })).toBeInTheDocument()
  })
  expect(
    bridgeMocks.Storage.setItem.mock.calls.some(
      ([key]) => key === storageKeys.settlements,
    ),
  ).toBe(false)

  historyReadFails = false
  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  await waitFor(() => {
    const mergedWrite = bridgeMocks.Storage.setItem.mock.calls.find(
      ([key, value]) =>
        key === storageKeys.settlements &&
        value.includes('existing-record') &&
        value.includes('강남역 삼겹살 모임'),
    )
    expect(mergedWrite).toBeDefined()
  })
})

test('uses TDS Mobile primitives for the main UI surfaces', () => {
  const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')

  expect(appSource).toMatch(/import \{[^}]*BottomCTA[^}]*BottomSheet[^}]*Button[^}]*ConfirmDialog[^}]*IconButton[^}]*ListHeader[^}]*ListRow[^}]*SegmentedControl[^}]*Tab[^}]*TextField[^}]*Top[^}]*\} from '@toss\/tds-mobile'/)
  expect(appSource).toMatch(/<Top[\s>]/)
  expect(appSource).toMatch(/<BottomCTA\.Single[\s>]/)
  expect(appSource).toMatch(/<BottomSheet[\s>]/)
  expect(appSource).toMatch(/<TextField/)
  expect(appSource).toMatch(/<ListRow[\s>]/)
  expect(appSource).toMatch(/<SegmentedControl[\s>]/)
  expect(appSource).toMatch(/<Tab[\s>]/)
})

test('summary banners reserve a separate icon column to avoid clipping content', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.summary-banner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s)
  expect(styles).toMatch(/\.summary-banner\s*\{[^}]*grid-template-rows:\s*auto\s+auto/s)
  expect(styles).toMatch(/\.summary-banner\s*\{[^}]*height:\s*auto/s)
  expect(styles).toMatch(/\.summary-banner\s*\{[^}]*min-height:\s*(?:9[0-9]|[1-9][0-9]{2,})px/s)
  expect(styles).toMatch(/\.summary-banner\s*\{[^}]*overflow:\s*visible/s)
  expect(styles).not.toMatch(/\.summary-banner\s*\{[^}]*overflow:\s*hidden/s)
  expect(styles).toMatch(/\.compact-summary\s*\{[^}]*min-height:\s*(?:8[0-9]|9[0-9]|[1-9][0-9]{2,})px/s)
  expect(styles).toMatch(/\.summary-banner \.material-symbols-outlined\s*\{[^}]*position:\s*static/s)
})

test('settlement flow screen scrolls internally inside the Toss WebView shell', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/html,\s*body,\s*#root\s*\{[^}]*height:\s*100%/s)
  expect(styles).toMatch(/body\s*\{[^}]*overflow:\s*hidden/s)
  expect(styles).toMatch(/\.phone-shell\s*\{[^}]*height:\s*min\(884px,\s*calc\(100dvh\s*-\s*48px\)\)/s)
  expect(styles).toMatch(/\.screen\s*\{[^}]*min-height:\s*0/s)
  expect(styles).toMatch(/\.screen\s*\{[^}]*overscroll-behavior:\s*contain/s)
  expect(styles).toMatch(/\.screen\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/s)
})

test('app shell blocks horizontal dragging while preserving vertical touch scrolling', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overflow-x:\s*hidden/s)
  expect(styles).toMatch(/html,\s*body,\s*#root\s*\{[^}]*max-width:\s*100%/s)
  expect(styles).toMatch(/body\s*\{[^}]*touch-action:\s*pan-y/s)
  expect(styles).toMatch(/\.app\s*\{[^}]*overflow-x:\s*hidden/s)
  expect(styles).toMatch(/\.app\s*\{[^}]*touch-action:\s*pan-y/s)
  expect(styles).toMatch(/\.phone-shell\s*\{[^}]*overflow-x:\s*hidden/s)
  expect(styles).toMatch(/\.screen\s*\{[^}]*overflow-x:\s*hidden/s)
  expect(styles).toMatch(/\.screen\s*\{[^}]*touch-action:\s*pan-y/s)
})

test('material icon ligatures stay hidden until the icon font is ready', () => {
  const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(appSource).toMatch(/data-icon=\{children\}/)
  expect(appSource).toMatch(/icon-font-ready/)
  expect(styles).toMatch(/\.material-symbols-outlined\[data-icon\]\s*\{[^}]*color:\s*transparent/s)
  expect(styles).toMatch(/\.material-symbols-outlined\.icon-font-ready\s*\{[^}]*color:\s*inherit/s)
})

test('start screen keeps saved recent settlements out of the home surface', async () => {
  bridgeMocks.Storage.getItem.mockImplementation(async (key) => {
    if (key === storageKeys.settlements) {
      return JSON.stringify([{
        id: 'recent-real',
        title: '저장된 최근 모임',
        amount: 84000,
        participants: ['민수', '지훈', '수진', '영희'],
        mode: 'equal',
        modeLabel: '똑같이 나누기',
        selectedParticipant: '',
        lineItems: [],
        completedAt: '2026-07-14T10:00:00.000Z',
      }])
    }
    return null
  })
  const { container } = renderApp()

  expect(await screen.findByRole('button', { name: /바로 룰렛 시작/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /설정하고 시작/ })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /최근 정산.*저장된 최근 모임.*84,000원.*4명/ })).not.toBeInTheDocument()
  })
  expect(container.querySelector('.settlement-visual')).toBeInTheDocument()
  expect(container.querySelector('.receipt-card')).not.toBeInTheDocument()
})

test('reaction play screen styles fit without forcing vertical scrolling', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.reaction-screen\s*\{[^}]*overflow-y:\s*hidden/s)
  expect(styles).toMatch(/\.reaction-screen\s*\{[^}]*padding:\s*1[0-9]px\s+20px\s+1[6-9][0-9]px/s)
  expect(styles).toMatch(/\.reaction-stage\s*\{[^}]*min-height:\s*0/s)
  expect(styles).toMatch(/\.reaction-stage\s*\{[^}]*height:\s*clamp\(/s)
  expect(styles).not.toMatch(/\.reaction-stage\s*\{[^}]*min-height:\s*560px/s)
})

test('reaction screen keeps game content and CTA above the bottom navigation', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.reaction-screen\s*\{[^}]*padding:\s*1[0-9]px\s+20px\s+1[6-9][0-9]px/s)
  expect(styles).toMatch(/\.reaction-stage\s*\{[^}]*height:\s*clamp\(3[0-3][0-9]px,\s*calc\(100dvh\s*-\s*5[0-9]{2}px\),\s*3[6-9][0-9]px\)/s)
  expect(styles).toMatch(/\.reaction-stage \.reaction-pad\s*\{[^}]*width:\s*min\(4[0-5]vw,\s*1[3-5][0-9]px\)/s)
  expect(styles).toMatch(/\.reaction-result-stats span\s*\{[^}]*min-height:\s*7[0-9]px/s)
  expect(styles).toMatch(/\.reaction-result-stats span\s*\{[^}]*overflow:\s*visible/s)
})

test('multi-person tie rematch styles show all targets in a compact grid', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.tie-rematch-matchup\.multi\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  expect(styles).toMatch(/\.tie-rematch-matchup\.multi \.tie-versus\s*\{[^}]*display:\s*none/s)
  expect(styles).toMatch(/\.tie-rematch-player-card\.compact\s*\{[^}]*min-height:\s*6[0-9]px/s)
  expect(styles).toMatch(/\.tie-rematch-player-card\.compact\s*\{[^}]*padding:\s*10px/s)
})

test('timing stop styles use an arcade result layout with a distinct target zone', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.timing-stage\s*\{[^}]*align-content:\s*start/s)
  expect(styles).toMatch(/\.timing-stage\s*\{[^}]*background:\s*var\(--surface\)/s)
  expect(styles).toMatch(/\.timing-stage\s*\{[^}]*box-shadow:\s*var\(--shadow\)/s)
  expect(styles).not.toMatch(/\.timing-stage\s*\{[^}]*linear-gradient/s)
  expect(styles).toMatch(/\.timing-arena\s*\{[^}]*background:\s*var\(--surface-low\)/s)
  expect(styles).toMatch(/\.timing-target-zone\s*\{[^}]*position:\s*absolute/s)
  expect(styles).toMatch(/\.timing-pointer\s*\{[^}]*position:\s*absolute/s)
  expect(styles).toMatch(/\.timing-pointer\s*\{[^}]*transition:\s*none/s)
  expect(styles).not.toMatch(/\.timing-pointer\s*\{[^}]*animation:/s)
  expect(styles).toMatch(/\.timing-result-panel\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
  expect(styles).toMatch(/\.timing-grade-badge\s*\{[^}]*overflow-wrap:\s*anywhere/s)
})

test('memory cards use four columns while the number board keeps three', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.number-board\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/s)
  expect(styles).toMatch(/\.memory-board\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\)/s)
})

test('renders the Stitch start screen copy and primary action', () => {
  renderApp()

  expect(screen.getByRole('heading', { name: /오늘 정산, 재미있게 결정해요/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '금액과 참여자를 입력하면 각자 낼 금액을 계산해 드려요' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /바로 룰렛 시작/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /설정하고 시작/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /게임 고르기/ })).toBeInTheDocument()
})

test('lets users skip the optional settlement title', () => {
  renderApp()

  startSettlement()

  expect(screen.getByRole('heading', { name: '어떤 정산인가요?' })).toBeInTheDocument()
  expect(screen.getByText('정산 이름은 나중에 기록을 찾기 위한 선택 항목이에요.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /금액 입력하기/ }))

  expect(screen.getByRole('heading', { name: '얼마를 나눌까요?' })).toBeInTheDocument()
})

test('moves backward to the immediately previous home flow screen', () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))

  expect(screen.getByRole('heading', { name: '어떻게 나눌까요?' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '이전 화면' }))
  expect(screen.getByRole('heading', { name: '누가 함께했나요?' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '이전 화면' }))
  expect(screen.getByRole('heading', { name: '얼마를 나눌까요?' })).toBeInTheDocument()
})

test('participant entry stops at eight people with a clear explanation', () => {
  const { container } = renderApp()

  startSettlement()
  enterAmountWithQuickButton()

  const nameInput = container.querySelector('.participant-form input')
  for (const name of ['친구1', '친구2', '친구3', '친구4', '친구5']) {
    fireEvent.change(nameInput, { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
  }

  expect(screen.getByText('총 8명')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('최대 8명까지 참여할 수 있어요.')
  expect(screen.queryByText('친구5')).not.toBeInTheDocument()
})

test('amount keypad appends integer digits and removes the decimal key', () => {
  renderApp()

  startSettlement()
  enterSettlementTitle()
  expect(screen.getByRole('button', { name: /참여자 입력하기/ })).toBeDisabled()
  expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '1' }))
  fireEvent.click(screen.getByRole('button', { name: '2' }))
  fireEvent.click(screen.getByRole('button', { name: '00' }))

  expectDisplayedAmount('1,200')
  expect(screen.getByRole('button', { name: /참여자 입력하기/ })).not.toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: '지우기' }))
  expectDisplayedAmount('120')

  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
  expectDisplayedAmount('0')
  expect(screen.getByRole('button', { name: /참여자 입력하기/ })).toBeDisabled()
})

test('selects exempt settlement and shows roulette animation before the result', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  expect(screen.getByRole('heading', { name: '면제 정산을 설정해 주세요' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  expect(screen.getByText('룰렛 돌리는 중')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /룰렛 돌리는 중/ })).toBeDisabled()
  expect(screen.queryByRole('heading', { name: /영희 님이 면제됐어요/ })).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('룰렛 돌리기 한 명 면제 방식 적용')).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /같은 설정으로 다시하기/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /다른 게임으로 다시하기/ })).toBeInTheDocument()
})

test('opens the share sheet directly from the integrated game result', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('강남역 삼겹살 모임')).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /이미지로 저장/ }))
  await waitFor(() => {
    expect(bridgeMocks.saveBase64Data).toHaveBeenCalledWith({
      data: expect.any(String),
      fileName: '강남역 삼겹살 모임.png',
      mimeType: 'image/png',
    })
  })

  fireEvent.click(screen.getByRole('button', { name: /결과 공유하기/ }))
  const dialog = screen.getByRole('dialog', { name: '정산 결과 공유' })
  expect(within(dialog).getByText('토스로 공유')).toBeInTheDocument()
  expect(within(dialog).getByText('링크 복사')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '공유창 닫기' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: '정산 결과 공유' })).not.toBeInTheDocument()
  })
})

async function openFinalShareSheet() {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /결과 공유하기/ }))

  return screen.getByRole('dialog', { name: '정산 결과 공유' })
}

test('share sheet actions call Toss bridge APIs with settlement payloads', async () => {
  const dialog = await openFinalShareSheet()

  expect(within(dialog).getByRole('button', { name: /토스로 공유/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /정산 요약 복사/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /링크 복사/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /이미지 저장/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /카카오톡으로 바로 보내기/ })).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: /토스로 공유/ }))
  await waitFor(() => {
    expect(bridgeMocks.getTossShareLink).toHaveBeenCalledWith(expect.stringMatching(/^intoss:\/\/nuganellae\/start\?/))
    expect(bridgeMocks.share).toHaveBeenCalledWith({
      message: expect.stringContaining('강남역 삼겹살 모임'),
    })
  })
  const deepLink = bridgeMocks.getTossShareLink.mock.calls.at(-1)[0]
  expect(deepLink).not.toContain(encodeURIComponent('강남역 삼겹살 모임'))
  expect(deepLink).not.toContain(encodeURIComponent('민수'))
  expect(deepLink).not.toContain('60000')

  fireEvent.click(within(dialog).getByRole('button', { name: /정산 요약 복사/ }))
  await waitFor(() => {
    expect(bridgeMocks.setClipboardText).toHaveBeenCalledWith(expect.stringContaining('총 정산 금액: 60,000원'))
  })

  fireEvent.click(within(dialog).getByRole('button', { name: /링크 복사/ }))
  await waitFor(() => {
    expect(bridgeMocks.setClipboardText).toHaveBeenCalledWith('https://toss.im/share?deep_link_value=nuganellae')
  })

  fireEvent.click(within(dialog).getByRole('button', { name: /이미지 저장/ }))
  await waitFor(() => {
    expect(bridgeMocks.saveBase64Data).toHaveBeenCalledWith({
      data: expect.any(String),
      fileName: '강남역 삼겹살 모임.png',
      mimeType: 'image/png',
    })
  })

  fireEvent.click(within(dialog).getByRole('button', { name: /카카오톡으로 바로 보내기/ }))
  await waitFor(() => {
    expect(bridgeMocks.share).toHaveBeenLastCalledWith({
      message: expect.stringContaining('카카오톡으로 공유해 주세요'),
    })
  })
})

test('sanitizes settlement titles for image file names', () => {
  expect(sanitizeFileName('강남역 삼겹살 모임')).toBe('강남역 삼겹살 모임.png')
  expect(sanitizeFileName('7/28: 회식?')).toBe('7-28- 회식.png')
  expect(sanitizeFileName('   ')).toBe('nuganellae-settlement-result.png')
})

test('bottom navigation opens truthful history and settings screens', () => {
  renderApp()

  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  expect(screen.getByRole('heading', { name: '정산 내역' })).toBeInTheDocument()
  expect(screen.getByText('누적 정산 금액')).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: '받을 정산' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '이전 화면' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
  expect(screen.getByText('서비스 이용 안내')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '서비스 이용 안내' }),
  ).not.toBeInTheDocument()
})

test('settings expose analytics opt-out and confirmed local data deletion', async () => {
  renderApp()
  fireEvent.click(screen.getByRole('button', { name: '설정' }))

  fireEvent.click(screen.getByRole('switch', { name: '익명 사용 통계 수집 안 함' }))
  await waitFor(() => {
    expect(bridgeMocks.Storage.setItem).toHaveBeenCalledWith(storageKeys.analyticsOptOut, 'true')
  })

  fireEvent.click(screen.getByRole('button', { name: /앱 데이터 전체 삭제/ }))
  const dialog = screen.getByRole('dialog', { name: '앱 데이터를 모두 삭제할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '모두 삭제' }))

  await waitFor(() => {
    expect(bridgeMocks.Storage.removeItem).toHaveBeenCalledWith(storageKeys.settlements)
    expect(bridgeMocks.Storage.removeItem).toHaveBeenCalledWith(storageKeys.draft)
    expect(bridgeMocks.Storage.removeItem).toHaveBeenCalledWith(storageKeys.lastSetup)
  })
})

test('keeps all settlement modes and lets roulette start from each mode', () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))

  for (const mode of ['똑같이 나누기', '한 명 면제', '꼴등 더 내기', '1등 덜 내기']) {
    expect(screen.getByRole('button', { name: new RegExp(mode) })).toBeInTheDocument()
  }
  expect(screen.queryByRole('button', { name: /한 명 더 내기/ })).not.toBeInTheDocument()
  expect(screen.getByTestId('method-extra')).toHaveTextContent('꼴등이 2인분을 부담해요.')

  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))

  expect(screen.getByRole('heading', { name: '면제 정산을 설정해 주세요' })).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('exempt-next'))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /룰렛 돌리기/ })).toBeInTheDocument()
})

test('equal settlement immediately shows a 1/N final result without starting a game', () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /똑같이 나누기/ }))
  fireEvent.click(screen.getByTestId('method-next'))

  expect(screen.getByRole('heading', { name: '정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('똑같이 나누기 방식 적용')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '게임 선택하기' })).not.toBeInTheDocument()
  expect(screen.getAllByText('12,500원')).toHaveLength(4)
})

test('loser extra payer mode explains the game settlement ratio before the game starts', () => {
  renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /꼴등 더 내기/ }))
  fireEvent.click(screen.getByTestId('method-next'))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()
  expect(screen.getByText(/꼴등은 2인분/)).toBeInTheDocument()
  expect(screen.getByText(/꼴등 24,000원/)).toBeInTheDocument()
  expect(screen.getByText(/나머지 각 12,000원/)).toBeInTheDocument()
})

test('discount winner mode explains the 50 percent discount before the game starts', () => {
  renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /1등 덜 내기/ }))
  fireEvent.click(screen.getByTestId('method-next'))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()
  expect(screen.getByText(/1등은 기본 1\/N의 50%/)).toBeInTheDocument()
  expect(screen.getByText(/1등 7,500원/)).toBeInTheDocument()
  expect(screen.getByText(/나머지 각 17,500원/)).toBeInTheDocument()
})

test('loser extra payer settlement charges the selected random participant two shares', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /꼴등 더 내기/ }))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('game-card-roulette'))
  fireEvent.click(screen.getByTestId('roulette-quick-draw'))

  await act(async () => {
    vi.advanceTimersByTime(400)
  })
  vi.useRealTimers()

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('룰렛 돌리기 꼴등 더 내기 적용')).toBeInTheDocument()
  expect(screen.getByText('2인분 부담')).toBeInTheDocument()
  expect(screen.getByText('20,000원')).toBeInTheDocument()
  expect(screen.getAllByText('10,000원')).toHaveLength(3)
})

test('game selection publishes seven games with player and duration guidance', () => {
  openGameSelectForExecution()

  expect(screen.getAllByTestId(/^game-card-/)).toHaveLength(7)
  expect(screen.queryByTestId('game-card-fastRandom')).not.toBeInTheDocument()
  expect(screen.queryByTestId('game-card-movingTarget')).not.toBeInTheDocument()
  expect(screen.getAllByText(/추천 2~/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/예상/).length).toBeGreaterThan(0)
})

test('loser extra payer ranking game rematches tied last-place players', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /꼴등 더 내기/ }))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('game-card-fiveSeconds'))
  fireEvent.click(screen.getByTestId('ranking-ready-start'))

  await completeFiveSecondTurn('민수', 5000)
  await completeFiveSecondTurn('지훈', 5100)
  await completeFiveSecondTurn('수진', 5400)
  await completeFiveSecondTurn('영희', 5400)

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getByText('재대결 대상 2명')).toBeInTheDocument()
  expect(screen.getByTestId('tie-rematch-matchup')).toHaveClass('multi')
  expect(screen.queryByText('VS')).not.toBeInTheDocument()
  const tiedCards = screen.getAllByTestId('tie-rematch-player-card')
  expect(tiedCards).toHaveLength(2)
  expect(tiedCards[0]).toHaveClass('compact')
  expect(tiedCards[1]).toHaveClass('compact')
  expect(tiedCards[0]).toHaveTextContent('수진')
  expect(tiedCards[1]).toHaveTextContent('영희')

  fireEvent.click(screen.getByTestId('tie-rematch-start'))
  expect(screen.getByText('1/2 플레이어')).toBeInTheDocument()
  expect(screen.getByText('수진 님 차례예요')).toBeInTheDocument()

  await completeFiveSecondTurn('수진', 5000)
  await completeFiveSecondTurn('영희', 5000)

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getAllByTestId('tie-rematch-player-card')).toHaveLength(2)
})

test('loser extra payer ranking rematch settles the single loser as two-share payer', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /꼴등 더 내기/ }))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('game-card-fiveSeconds'))
  fireEvent.click(screen.getByTestId('ranking-ready-start'))

  await completeFiveSecondTurn('민수', 5000)
  await completeFiveSecondTurn('지훈', 5100)
  await completeFiveSecondTurn('수진', 5400)
  await completeFiveSecondTurn('영희', 5400)

  fireEvent.click(screen.getByTestId('tie-rematch-start'))

  await completeFiveSecondTurn('수진', 5000)
  await completeFiveSecondTurn('영희', 5400)

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText(/꼴등 더 내기 적용/)).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
  expect(screen.getByText('2인분 부담')).toBeInTheDocument()
})

test('ranking game sends the first-place player to the game settlement result as exempt winner', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /반응속도 대결/ }))
  fireEvent.click(screen.getByTestId('ranking-ready-start'))
  await completeReactionTurn('민수', 100)
  await completeReactionTurn('지훈', 200)
  await completeReactionTurn('수진', 300)
  await completeReactionTurn('영희', 400)

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getAllByText('민수').length).toBeGreaterThan(0)
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()
})

test('tie for first place starts a real rematch before final settlement', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /딱 5초 챌린지/ }))
  fireEvent.click(screen.getByTestId('ranking-ready-start'))

  await completeFiveSecondTurn('민수', 5000)
  await completeFiveSecondTurn('지훈', 5000)
  await completeFiveSecondTurn('수진', 5400)
  await completeFiveSecondTurn('영희', 5400)

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getByText('동점인 참여자끼리 한 번 더 대결해 순위를 정해요.')).toBeInTheDocument()
  expect(screen.getByText('재대결 대상 2명')).toBeInTheDocument()
  expect(screen.getByTestId('tie-rematch-matchup')).toHaveClass('multi')
  expect(screen.queryByText('VS')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('tie-rematch-player-card')).toHaveLength(2)
  expect(screen.getByTestId('tie-rematch-rule')).toHaveTextContent('이전 게임을 한 번 더 진행하여, 동점자 사이의 최종 순위를 가려냅니다.')
  expect(screen.queryByRole('button', { name: /면제자로 확정/ })).not.toBeInTheDocument()

  fireEvent.click(screen.getByTestId('tie-rematch-start'))
  expect(screen.getByText('1/2 플레이어')).toBeInTheDocument()
  expect(screen.getByText('민수 님 차례예요')).toBeInTheDocument()

  fireEvent.click(screen.getByTestId('participant-turn-start'))
  fireEvent.click(screen.getByTestId('five-second-start'))
  await act(async () => {
    vi.advanceTimersByTime(5000)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))

  fireEvent.click(screen.getByTestId('participant-turn-start'))
  fireEvent.click(screen.getByTestId('five-second-start'))
  await act(async () => {
    vi.advanceTimersByTime(5400)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('민수')).toBeInTheDocument()
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()
})

test('tie rematch can repeat when rematch players tie again', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /딱 5초 챌린지/ }))
  fireEvent.click(screen.getByTestId('ranking-ready-start'))

  await completeFiveSecondTurn('민수', 5000)
  await completeFiveSecondTurn('지훈', 5000)
  await completeFiveSecondTurn('수진', 5400)
  await completeFiveSecondTurn('영희', 5400)

  fireEvent.click(screen.getByTestId('tie-rematch-start'))

  for (const participant of ['민수', '지훈']) {
    await completeFiveSecondTurn(participant, 5000)
  }

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getAllByTestId('tie-rematch-player-card')).toHaveLength(2)
})

test('tie rematch shows five rematch targets at once in compact cards', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const { container } = renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.change(container.querySelector('.participant-form input'), { target: { value: '새친구' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-extra'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

  for (const participant of ['민수', '지훈', '수진', '영희', '새친구']) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`시작하기`) }))
    await advanceGameCountdown()
    fireEvent.click(screen.getByTestId('reaction-action'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getByText('재대결 대상 5명')).toBeInTheDocument()
  expect(screen.getByTestId('tie-rematch-matchup')).toHaveClass('multi')

  const tiedCards = screen.getAllByTestId('tie-rematch-player-card')
  expect(tiedCards).toHaveLength(5)
  for (const participant of ['민수', '지훈', '수진', '영희', '새친구']) {
    expect(screen.getByText(participant)).toBeInTheDocument()
  }
})
function openGameSelectForExecution() {
  renderApp()
  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-exempt'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('exempt-next'))
}

function startRankingGameForExecution(gameId) {
  openGameSelectForExecution()
  fireEvent.click(screen.getByTestId(`game-card-${gameId}`))
  const readyStart = screen.queryByTestId('ranking-ready-start')
  if (readyStart) {
    fireEvent.click(readyStart)
    return
  }
  const gameSelectNext = screen.queryByTestId('game-select-next')
  if (gameSelectNext) {
    fireEvent.click(gameSelectNext)
  }
  const rulesNext = screen.queryByTestId('game-rules-next')
  if (rulesNext) {
    fireEvent.click(rulesNext)
  }
  const orderNext = screen.queryByTestId('play-order-next')
  if (orderNext) {
    fireEvent.click(orderNext)
  }
  const turnStart = screen.queryByTestId('participant-turn-start')
  if (turnStart) {
    fireEvent.click(turnStart)
  }
}

function startExtraReactionGameForExecution() {
  renderApp()
  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-extra'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))
}

async function advanceGameCountdown() {
  for (let tick = 0; tick < 3; tick += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
}

test('automatic ranking games show a countdown before gameplay controls appear', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('reaction')

  const overlay = screen.getByTestId('game-countdown-overlay')
  expect(overlay).toBeInTheDocument()
  expect(overlay).toHaveAttribute('role', 'status')
  expect(overlay).toHaveAttribute('aria-live', 'assertive')
  expect(overlay.parentElement).toHaveClass('ranking-game-screen')
  expect(overlay.parentElement).toHaveClass('preparing-countdown')
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('3')
  expect(screen.queryByTestId('reaction-action')).not.toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('2')

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('1')

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('reaction-action')).toBeInTheDocument()
})

test('reaction countdown preview matches the play screen tap layout', () => {
  vi.useFakeTimers()
  startRankingGameForExecution('reaction')

  const preview = document.querySelector('.countdown-preview.reaction-stage')
  expect(preview).toBeInTheDocument()
  expect(preview.querySelector('.reaction-turn-card')).toBeInTheDocument()
  expect(preview.querySelector('.reaction-pad.waiting')).toBeInTheDocument()
  expect(preview.querySelector('.reaction-copy')).toHaveTextContent('기다려주세요')
  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.queryByTestId('reaction-action')).not.toBeInTheDocument()
})

test('number order game counts down for three seconds and starts automatically', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('numberOrder')

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('3')
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.queryByTestId('number-tile-1')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.countdown-preview .number-board button')).toHaveLength(9)

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('2')

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('1')

  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.queryByTestId('number-start')).not.toBeInTheDocument()
  expect(screen.getAllByTestId(/^number-tile-/)).toHaveLength(9)
  expect(screen.getByTestId('number-tile-1')).toBeEnabled()
})

test('number order game restarts the countdown for the next participant', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('numberOrder')
  await advanceGameCountdown()

  for (let tile = 1; tile <= 9; tile += 1) {
    fireEvent.click(screen.getByTestId(`number-tile-${tile}`))
  }
  fireEvent.click(screen.getByTestId('complete-game-turn'))
  fireEvent.click(screen.getByTestId('participant-turn-start'))

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.getByTestId('game-countdown-number')).toHaveTextContent('3')
  expect(screen.queryByTestId('number-tile-1')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.countdown-preview .number-board button')).toHaveLength(9)

  await advanceGameCountdown()
  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('number-tile-1')).toBeEnabled()
})

test('participant turn changes are announced to assistive technology', () => {
  openGameSelectForExecution()
  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

  const turnStatus = screen.getByRole('status')
  expect(turnStatus).toHaveAttribute('aria-live', 'polite')
  expect(turnStatus).toHaveTextContent(/님 차례예요/)
})

function openExemptSettingsForExecution() {
  renderApp()
  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-exempt'))
  fireEvent.click(screen.getByTestId('method-next'))
}

test('exempt settings use a switch for allowing result reselection', () => {
  openExemptSettingsForExecution()

  expect(screen.getByRole('switch', { name: /결과 재선택 허용/ })).toHaveAttribute('aria-checked', 'false')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('enabled result reselection requires confirmation before discarding the official result', async () => {
  vi.useFakeTimers()
  openExemptSettingsForExecution()
  fireEvent.click(screen.getByRole('switch', { name: /결과 재선택 허용/ }))
  fireEvent.click(screen.getByTestId('exempt-next'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('roulette-wheel-draw'))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })

  fireEvent.click(screen.getByRole('button', { name: /다시 뽑기/ }))
  expect(screen.getByRole('dialog', { name: '현재 결과를 폐기할까요?' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '결과 유지' }))
  expect(screen.getByRole('heading', { name: /님이 면제됐어요/ })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /다시 뽑기/ }))
  fireEvent.click(screen.getByRole('button', { name: '폐기하고 다시 하기' }))
  expect(screen.getByTestId('roulette-wheel-draw')).toBeInTheDocument()
})

test('final settlement locks the completed flow without a top back button', async () => {
  vi.useFakeTimers()
  const { container } = renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))

  expect(container.querySelector('.top-bar')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /새로운 정산/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /결과 공유하기/ })).toBeInTheDocument()
})

test('starting a new settlement from the completed screen clears the previous draft', async () => {
  vi.useFakeTimers()
  const { container } = renderApp()

  startSettlement()
  enterSettlementTitle()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.change(container.querySelector('.participant-form input'), { target: { value: '새친구' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByTestId('exempt-next'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /새로운 정산/ }))

  const titleInput = container.querySelector('.title-form input')
  expect(titleInput).toBeInTheDocument()
  expect(titleInput).toHaveValue('')

  fireEvent.change(titleInput, { target: { value: '두 번째 정산' } })
  fireEvent.click(screen.getByRole('button', { name: /금액 입력하기/ }))

  expectDisplayedAmount('0')
  expect(screen.getByRole('button', { name: /참여자 입력하기/ })).toBeDisabled()
})

test('starting a new settlement from a game result resets game choices and members', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const { container } = renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.change(container.querySelector('.participant-form input'), { target: { value: '새친구' } })
  fireEvent.click(screen.getByRole('button', { name: '추가' }))
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-exempt'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('exempt-next'))
  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

  await completeReactionTurn('민수', 100)
  await completeReactionTurn('지훈', 200)
  await completeReactionTurn('수진', 300)
  await completeReactionTurn('영희', 400)
  await completeReactionTurn('새친구', 500)

  fireEvent.click(screen.getByRole('button', { name: /최종 정산 보기/ }))
  fireEvent.click(screen.getByRole('button', { name: /새로운 정산/ }))
  fireEvent.change(screen.getByLabelText('정산 타이틀'), { target: { value: '다시 시작' } })
  fireEvent.click(screen.getByRole('button', { name: /금액 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))

  expect(screen.queryByText('새친구')).not.toBeInTheDocument()

  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('exempt-next'))

  expect(screen.getByTestId('game-card-roulette')).toHaveClass('selected-card')
  expect(screen.getByTestId('game-card-reaction')).not.toHaveClass('selected-card')
})

test('disabled result reselection hides result back navigation and retry actions', async () => {
  vi.useFakeTimers()
  const { container } = renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-exempt'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('exempt-next'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  expect(container.querySelector('.top-bar')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /다시 뽑기/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /금액 확인하기/ })).toBeInTheDocument()
})

test('leaving an in-progress ranking game uses a TDS confirmation dialog before resetting to game select', () => {
  vi.useFakeTimers()
  const confirmSpy = vi.spyOn(window, 'confirm')
  const { container } = renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByTestId('participants-next'))
  fireEvent.click(screen.getByTestId('method-exempt'))
  fireEvent.click(screen.getByTestId('method-next'))
  fireEvent.click(screen.getByTestId('exempt-next'))
  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))
  fireEvent.click(screen.getByTestId('participant-turn-start'))

  fireEvent.click(container.querySelector('.top-bar button'))

  expect(confirmSpy).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog', { name: '게임을 나갈까요?' })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText('게임을 나가면 현재 기록이 초기화돼요.')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: '계속하기' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: '나가기' })).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: '계속하기' }))
  expect(screen.queryByRole('dialog', { name: '게임을 나갈까요?' })).not.toBeInTheDocument()
  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()

  fireEvent.click(container.querySelector('.top-bar button'))
  fireEvent.click(within(screen.getByRole('dialog', { name: '게임을 나갈까요?' })).getByRole('button', { name: '나가기' }))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()

  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))
  expect(screen.getByText(/1\/4/)).toBeInTheDocument()
})

test('reaction game uses the large purple tap-focused play screen after countdown', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')

  await advanceGameCountdown()

  expect(screen.getByText(/님의 차례/)).toBeInTheDocument()
  expect(screen.getByText('기다려주세요')).toBeInTheDocument()
  expect(screen.getByText('신호가 뜨면 바로 탭하세요')).toBeInTheDocument()
  expect(screen.queryByText('지금 누르세요!')).not.toBeInTheDocument()
  expect(screen.getByTestId('reaction-action')).toBeEnabled()

  await act(async () => {
    vi.advanceTimersByTime(2999)
  })
  expect(screen.getByText('기다려주세요')).toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(1)
  })
  expect(screen.getByText('지금 누르세요!')).toBeInTheDocument()
  expect(screen.getByText('지금 바로 탭하세요!')).toBeInTheDocument()
})

test('reaction game cannot reset the same turn while waiting for the signal', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('reaction')

  await advanceGameCountdown()

  expect(screen.getByText('기다려주세요')).toBeInTheDocument()
  expect(screen.queryByTestId('reaction-reset')).not.toBeInTheDocument()
})

test('backgrounding a ranking game discards the active attempt and returns to the same participant', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('reaction')
  await advanceGameCountdown()

  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  fireEvent(document, new Event('visibilitychange'))

  expect(screen.getByText('민수 님 차례예요')).toBeInTheDocument()
  expect(screen.getByText('앱이 백그라운드로 이동해 이번 기록을 폐기했어요.')).toBeInTheDocument()

  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

test('reaction game shows a result panel after a valid tap', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')

  await advanceGameCountdown()
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  await act(async () => {
    vi.advanceTimersByTime(123)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))

  expect(screen.getByTestId('reaction-action')).toBeInTheDocument()
  expect(screen.getByTestId('reaction-result-panel')).toHaveTextContent(/\d+\.\d{3}초/)
  expect(screen.getByText('매우 빠른 반응이에요!')).toBeInTheDocument()
  expect(screen.getByText('평균 대비')).toBeInTheDocument()
  expect(screen.getByText('현재 순위')).toBeInTheDocument()
  expect(screen.getByText('1위')).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()

  fireEvent.click(screen.getByTestId('complete-game-turn'))
  for (const reactionMs of [140, 160, 180]) {
    fireEvent.click(screen.getByTestId('participant-turn-start'))
    await advanceGameCountdown()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await act(async () => {
      vi.advanceTimersByTime(reactionMs)
    })
    fireEvent.click(screen.getByTestId('reaction-action'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

  expect(screen.getAllByText(/^\d+ms$/).length).toBeGreaterThan(0)
  expect(screen.queryByText('reaction recordedms')).not.toBeInTheDocument()
})

test('reaction game ranks the current result against previous scores', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')

  await advanceGameCountdown()
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))
  fireEvent.click(screen.getByTestId('participant-turn-start'))

  await advanceGameCountdown()
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  await act(async () => {
    vi.advanceTimersByTime(100)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))

  const resultPanel = screen.getByTestId('reaction-result-panel')
  expect(resultPanel).toHaveTextContent(/\d+\.\d{3}초/)
  expect(within(resultPanel).getByText('평균 대비')).toBeInTheDocument()
  expect(within(resultPanel).getByText(/^\d+위$/)).toBeInTheDocument()
})

test('reaction game rules warn that tapping before the signal makes the player last place', () => {
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-reaction'))
  fireEvent.click(screen.getByTestId('game-select-next'))

  expect(screen.getByText(/신호 전 클릭은 실격 점수로 기록/)).toBeInTheDocument()
})

test('timing stop rules explain the 100 point center target scoring', () => {
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-timingStop'))
  fireEvent.click(screen.getByTestId('game-select-next'))

  expect(screen.getByText(/중앙에 가까울수록 100점에 가까워지고, 한 번의 정지/)).toBeInTheDocument()
})

test('timing stop position uses a smooth eased round trip instead of 80ms jumps', async () => {
  const module = await import('./App')

  expect(module.getTimingStopPosition).toBeTypeOf('function')
  expect(module.getTimingStopPosition(0)).toBeCloseTo(0, 3)
  expect(module.getTimingStopPosition(400)).toBeCloseTo(50, 1)
  expect(module.getTimingStopPosition(800)).toBeCloseTo(100, 3)
  expect(module.getTimingStopPosition(1200)).toBeCloseTo(50, 1)
  expect(module.getTimingStopPosition(1600)).toBeCloseTo(0, 3)
  expect(module.getTimingStopPosition(16)).toBeGreaterThan(0)
  expect(module.getTimingStopPosition(16)).toBeLessThan(7)
})

test('manual-start ranking games do not show the countdown overlay', () => {
  vi.useFakeTimers()
  startRankingGameForExecution('fiveSeconds')

  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('five-second-start')).toBeInTheDocument()
})

test('ranking games keep the turn completion button disabled until a score is recorded', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')

  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  await advanceGameCountdown()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
})

test('timing stop starts after the countdown finishes', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('timingStop')

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.queryByTestId('timing-stop')).not.toBeInTheDocument()

  await advanceGameCountdown()

  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('timing-stop')).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()

  fireEvent.click(screen.getByTestId('timing-stop'))
  const resultPanel = screen.getByTestId('timing-result-panel')
  expect(resultPanel).toBeInTheDocument()
  expect(within(resultPanel).getByText(/\d+\.\d점/)).toBeInTheDocument()
  expect(within(resultPanel).getByText(/중앙에서/)).toBeInTheDocument()
  expect(within(resultPanel).getByText(/정확|훌륭|좋음|아쉬움/)).toBeInTheDocument()
  expect(screen.queryByText(/target distance/)).not.toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

test('timing stop position follows a continuous cosine path inside the track', () => {
  const at33ms = getTimingStopPosition(33)
  const at34ms = getTimingStopPosition(34)

  expect(at33ms).toBeGreaterThan(0)
  expect(at33ms).toBeLessThan(100)
  expect(at34ms).toBeGreaterThan(at33ms)
  expect(at34ms - at33ms).toBeLessThan(1)
})

test('timing stop ranking result shows decimal point scores without millisecond labels', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('timingStop')

  const turnWaitTimes = [400, 100, 700, 250]

  for (let index = 0; index < turnWaitTimes.length; index += 1) {
    if (index > 0) {
      fireEvent.click(screen.getByTestId('participant-turn-start'))
    }
    await advanceGameCountdown()
    await act(async () => {
      vi.advanceTimersByTime(turnWaitTimes[index])
    })
    fireEvent.click(screen.getByTestId('timing-stop'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

  expect(screen.getByRole('heading', { name: '전체 순위 결과' })).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(4)
  for (const row of rows) {
    expect(within(row).getByText(/\d+\.\d점/)).toBeInTheDocument()
  }
  expect(screen.queryByText(/ms/)).not.toBeInTheDocument()
})

test('roulette quick mode uses the same fair draw and reveals the result quickly', async () => {
  vi.useFakeTimers()
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-roulette'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  expect(screen.getByText('모든 참여자의 선택 확률은 1/4이에요.')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('roulette-quick-draw'))

  await act(async () => {
    vi.advanceTimersByTime(400)
  })

  expect(screen.getByRole('heading', { name: /영희 님이 면제됐어요/ })).toBeInTheDocument()
})

test('receipt envelope locks the first choice and reveals its shuffled assignment', async () => {
  vi.useFakeTimers()
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-receiptEnvelope'))
  fireEvent.click(screen.getByTestId('game-select-next'))

  expect(screen.getByText('모든 참여자의 선택 확률은 1/4이에요.')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('receipt-envelope-2'))
  expect(screen.getByTestId('receipt-envelope-2')).toHaveClass('selected-envelope')
  expect(screen.getByTestId('receipt-envelope-1')).toBeDisabled()

  await act(async () => {
    vi.advanceTimersByTime(650)
  })

  expect(screen.getByTestId('random-result-name')).toBeInTheDocument()
  expect(screen.getByTestId('random-result-next')).toBeInTheDocument()
})

test('reaction game records an early tap once and prevents retrying the same turn', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')
  await advanceGameCountdown()

  fireEvent.click(screen.getByTestId('reaction-action'))
  expect(screen.getByText('너무 빨랐어요!')).toBeInTheDocument()
  expect(screen.getByText('신호 전 클릭으로 꼴등 처리돼요.')).toBeInTheDocument()
  expect(screen.queryByTestId('reaction-reset')).not.toBeInTheDocument()
  expect(screen.getByTestId('reaction-action')).toBeDisabled()

  fireEvent.click(screen.getByTestId('reaction-action'))
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })

  expect(screen.queryByText('0.000초')).not.toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

test('reaction game treats early taps as last-place scores and rematches tied last-place players', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startExtraReactionGameForExecution()

  expect(screen.getByText(/신호 전 클릭은 실격 점수로 기록/)).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

  for (const reactionMs of [150, 180]) {
    fireEvent.click(screen.getByTestId('participant-turn-start'))
    await advanceGameCountdown()
    await act(async () => {
      vi.advanceTimersByTime(3000 + reactionMs)
    })
    fireEvent.click(screen.getByTestId('reaction-action'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

  for (let index = 0; index < 2; index += 1) {
    fireEvent.click(screen.getByTestId('participant-turn-start'))
    await advanceGameCountdown()
    fireEvent.click(screen.getByTestId('reaction-action'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  const tiedCards = screen.getAllByTestId('tie-rematch-player-card')
  expect(tiedCards).toHaveLength(2)
  expect(tiedCards[0]).toHaveTextContent('수진')
  expect(tiedCards[1]).toHaveTextContent('영희')
})

test('five second challenge measures the difference from five seconds', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('fiveSeconds')

  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  fireEvent.click(screen.getByTestId('five-second-start'))
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  await act(async () => {
    vi.advanceTimersByTime(5200)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))

  expect(screen.getByText(/5.200/)).toBeInTheDocument()
  expect(screen.getByText(/0.200/)).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

test('number order game adds mistake penalty to the final score', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('numberOrder')

  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  await advanceGameCountdown()
  expect(screen.queryByTestId('number-start')).not.toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  fireEvent.click(screen.getByTestId('number-tile-3'))
  fireEvent.click(screen.getByTestId('number-tile-1'))
  fireEvent.click(screen.getByTestId('number-tile-2'))
  fireEvent.click(screen.getByTestId('number-tile-3'))
  fireEvent.click(screen.getByTestId('number-tile-4'))
  fireEvent.click(screen.getByTestId('number-tile-5'))
  fireEvent.click(screen.getByTestId('number-tile-6'))
  fireEvent.click(screen.getByTestId('number-tile-7'))
  fireEvent.click(screen.getByTestId('number-tile-8'))
  await act(async () => {
    vi.advanceTimersByTime(1200)
  })
  fireEvent.click(screen.getByTestId('number-tile-9'))

  expect(screen.getByText(/실수: 1회/)).toBeInTheDocument()
  expect(screen.getByText(/벌점 반영 완료/)).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

test('memory card game completes real pairs and records attempts', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('memoryCard')

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.queryByText('카드 위치를 기억하세요')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.countdown-preview .memory-card')).toHaveLength(12)

  await advanceGameCountdown()
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.getAllByTestId(/^memory-card-/)).toHaveLength(12)
  expect(screen.getByTestId('memory-card-0')).toBeDisabled()

  await act(async () => {
    vi.advanceTimersByTime(3100)
  })
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.getByTestId('memory-card-0')).toBeEnabled()

  fireEvent.click(screen.getByTestId('memory-card-0'))
  fireEvent.click(screen.getByTestId('memory-card-6'))
  fireEvent.click(screen.getByTestId('memory-card-1'))
  fireEvent.click(screen.getByTestId('memory-card-7'))
  fireEvent.click(screen.getByTestId('memory-card-2'))
  fireEvent.click(screen.getByTestId('memory-card-8'))
  fireEvent.click(screen.getByTestId('memory-card-3'))
  fireEvent.click(screen.getByTestId('memory-card-9'))
  fireEvent.click(screen.getByTestId('memory-card-4'))
  fireEvent.click(screen.getByTestId('memory-card-10'))
  fireEvent.click(screen.getByTestId('memory-card-5'))
  fireEvent.click(screen.getByTestId('memory-card-11'))

  expect(screen.getByText(/시도 6회 · 오답 0회/)).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

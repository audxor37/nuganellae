import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, test, vi } from 'vitest'
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait'
import App, { sanitizeFileName } from './App'

const bridgeMocks = vi.hoisted(() => ({
  getTossShareLink: vi.fn(async () => 'https://toss.im/share?deep_link_value=nuganellae'),
  saveBase64Data: vi.fn(async () => undefined),
  setClipboardText: vi.fn(async () => undefined),
  share: vi.fn(async () => undefined),
}))

vi.mock('@apps-in-toss/web-framework', () => bridgeMocks)

vi.mock('@toss/tds-mobile', async (importOriginal) => {
  const actual = await importOriginal()
  const React = await import('react')

  return {
    ...actual,
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
  fireEvent.click(screen.getByRole('button', { name: /정산 시작하기/ }))
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
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${participant} 시작하기`) }))
  fireEvent.click(screen.getByTestId('five-second-start'))
  await act(async () => {
    vi.advanceTimersByTime(elapsedMs)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('uses TDS Mobile primitives for the main UI surfaces', () => {
  const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')

  expect(appSource).toMatch(/import \{[^}]*BottomCTA[^}]*BottomSheet[^}]*Button[^}]*IconButton[^}]*ListHeader[^}]*ListRow[^}]*SegmentedControl[^}]*Tab[^}]*TextField[^}]*Top[^}]*\} from '@toss\/tds-mobile'/)
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

test('start screen uses unclipped custom recent settlement and settlement visual', () => {
  const { container } = renderApp()

  const recentCard = screen.getByRole('button', { name: /최근 정산 \(7월 14일\).*84,000원.*강남역 삼겹살 모임/ })
  expect(recentCard).toHaveClass('recent-settlement-card')
  expect(container.querySelector('.settlement-visual')).toBeInTheDocument()
  expect(container.querySelector('.receipt-card')).not.toBeInTheDocument()
})

test('recent settlement card styles keep the text column from clipping', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')

  expect(styles).toMatch(/\.recent-settlement-card\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/s)
  expect(styles).toMatch(/\.recent-settlement-card\s*\{[^}]*min-height:\s*(?:7[0-9]|8[0-9]|9[0-9]|[1-9][0-9]{2,})px/s)
  expect(styles).toMatch(/\.recent-settlement-copy\s*\{[^}]*min-width:\s*0/s)
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

test('renders the Stitch start screen copy and primary action', () => {
  renderApp()

  expect(screen.getByRole('heading', { name: /오늘 정산, 재미있게 결정해요/ })).toBeInTheDocument()
  expect(screen.getByText('강남역 삼겹살 모임')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /정산 시작하기/ })).toBeInTheDocument()
})

test('requires a settlement title before entering the amount', () => {
  renderApp()

  startSettlement()

  expect(screen.getByRole('heading', { name: '어떤 정산인가요?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /금액 입력하기/ })).toBeDisabled()

  fireEvent.change(screen.getByLabelText('정산 타이틀'), { target: { value: '강남역 삼겹살 모임' } })
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

  expect(screen.getByRole('heading', { name: '영희 님이 면제됐어요' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '영희 님 면제 확정 이미지' })).toBeInTheDocument()
  expect(screen.getByText('면제 확정')).toBeInTheDocument()
  expect(screen.getByText('룰렛 결과 확인')).toBeInTheDocument()
  expect(screen.getByText('영희 님 면제')).toBeInTheDocument()
  expect(screen.getByText('나머지 인원 각 20,000원')).toBeInTheDocument()
  expect(screen.getByTestId('confetti-rain')).toBeInTheDocument()
})

test('continues from roulette result to final result with share sheet', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))

  expect(screen.getByRole('heading', { name: '정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('강남역 삼겹살 모임')).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()

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

  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /결과 공유하기/ }))

  return screen.getByRole('dialog', { name: '정산 결과 공유' })
}

test('share sheet actions call Toss bridge APIs with settlement payloads', async () => {
  const dialog = await openFinalShareSheet()

  expect(within(dialog).getByRole('button', { name: /토스로 공유/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /링크 복사/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /이미지 저장/ })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /카카오톡으로 바로 보내기/ })).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: /토스로 공유/ }))
  await waitFor(() => {
    expect(bridgeMocks.getTossShareLink).toHaveBeenCalledWith(expect.stringMatching(/^intoss:\/\/nuganellae\/settlement-result\?/))
    expect(bridgeMocks.share).toHaveBeenCalledWith({
      message: expect.stringContaining('강남역 삼겹살 모임'),
    })
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

test('bottom navigation opens history and settings screens', () => {
  renderApp()

  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  expect(screen.getByRole('heading', { name: '정산 내역' })).toBeInTheDocument()
  expect(screen.getByText('이번 달 보낸 정산금')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: '받을 정산' }))
  expect(screen.getByRole('radio', { name: '받을 정산' })).toBeChecked()

  fireEvent.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
  expect(screen.getByText('서비스 이용 안내')).toBeInTheDocument()
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
  expect(screen.getByText(/예상 선택자 24,000원/)).toBeInTheDocument()
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
  expect(screen.getByText(/1등\/선택자는 기본 1\/N의 50%/)).toBeInTheDocument()
  expect(screen.getByText(/예상 선택자 7,500원/)).toBeInTheDocument()
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
  fireEvent.click(screen.getByTestId('game-card-fastRandom'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('fast-random-draw'))

  await act(async () => {
    vi.advanceTimersByTime(2600)
  })
  vi.useRealTimers()

  fireEvent.click(screen.getByTestId('random-result-next'))

  expect(screen.getByRole('heading', { name: '정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('꼴등 더 내기 방식 적용')).toBeInTheDocument()
  expect(screen.getByText('2인분 부담')).toBeInTheDocument()
  expect(screen.getByText('20,000원')).toBeInTheDocument()
  expect(screen.getAllByText('10,000원')).toHaveLength(3)
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
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

  await completeFiveSecondTurn('민수', 5000)
  await completeFiveSecondTurn('지훈', 5100)
  await completeFiveSecondTurn('수진', 5400)
  await completeFiveSecondTurn('영희', 5400)

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  const tiedCards = screen.getAllByTestId('tie-rematch-player-card')
  expect(tiedCards).toHaveLength(2)
  expect(tiedCards[0]).toHaveTextContent('수진')
  expect(tiedCards[1]).toHaveTextContent('영희')

  fireEvent.click(screen.getByTestId('tie-rematch-start'))
  expect(screen.getByText('1/2 플레이어')).toBeInTheDocument()
  expect(screen.getByText('수진 님 차례예요')).toBeInTheDocument()

  fireEvent.click(screen.getByTestId('participant-turn-start'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))
  fireEvent.click(screen.getByTestId('participant-turn-start'))
  fireEvent.click(screen.getByTestId('complete-game-turn'))

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
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))

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

test('ranking game sends the first-place player to the game settlement result as exempt winner', () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /반응속도 대결/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /플레이 순서 확인/ }))
  fireEvent.click(screen.getByRole('button', { name: /첫 번째 참여자에게 넘기기/ }))
  fireEvent.click(screen.getByRole('button', { name: /민수 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  fireEvent.click(screen.getByRole('button', { name: /지훈 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  fireEvent.click(screen.getByRole('button', { name: /수진 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  fireEvent.click(screen.getByRole('button', { name: /영희 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))

  expect(screen.getByRole('heading', { name: '전체 순위 결과' })).toBeInTheDocument()
  expect(screen.getAllByText('1등').length).toBeGreaterThan(0)
  expect(screen.getByText('민수 님 면제권 획득')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /최종 정산 보기/ }))

  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('민수')).toBeInTheDocument()
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
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /플레이 순서 확인/ }))
  fireEvent.click(screen.getByRole('button', { name: /첫 번째 참여자에게 넘기기/ }))

  for (const participant of ['민수', '지훈', '수진', '영희']) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${participant} 시작하기`) }))
    fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  }

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getByText('동점인 참여자끼리 한 번 더 대결해 순위를 정해요.')).toBeInTheDocument()
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

test('tie rematch can repeat when rematch players tie again', () => {
  renderApp()

  startSettlement()
  enterAmountWithQuickButton()
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /딱 5초 챌린지/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /플레이 순서 확인/ }))
  fireEvent.click(screen.getByRole('button', { name: /첫 번째 참여자에게 넘기기/ }))

  for (const participant of ['민수', '지훈', '수진', '영희']) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${participant} 시작하기`) }))
    fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  }

  fireEvent.click(screen.getByTestId('tie-rematch-start'))

  for (const participant of ['민수', '지훈']) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${participant} 시작하기`) }))
    fireEvent.click(screen.getByRole('button', { name: /이번 차례 완료/ }))
  }

  expect(screen.getByRole('heading', { name: '동점자가 나왔어요!' })).toBeInTheDocument()
  expect(screen.getAllByTestId('tie-rematch-player-card')).toHaveLength(2)
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
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('game-rules-next'))
  fireEvent.click(screen.getByTestId('play-order-next'))
  fireEvent.click(screen.getByTestId('participant-turn-start'))
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

  expect(screen.getByRole('switch', { name: /결과 재선택 허용/ })).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
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
  fireEvent.click(screen.getByRole('switch', { name: /결과 재선택 허용/ }))
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

test('starting a new settlement from a game result resets game choices and members', () => {
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

  for (let turn = 0; turn < 5; turn += 1) {
    fireEvent.click(screen.getByTestId('participant-turn-start'))
    fireEvent.click(screen.getByTestId('complete-game-turn'))
  }

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
  fireEvent.click(screen.getByRole('switch', { name: /결과 재선택 허용/ }))
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

test('leaving an in-progress ranking game asks for confirmation before resetting to game select', () => {
  vi.useFakeTimers()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
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

  expect(confirmSpy).toHaveBeenCalledWith('게임을 나가면 현재 기록이 초기화돼요. 나갈까요?')
  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()

  confirmSpy.mockReturnValue(true)
  fireEvent.click(container.querySelector('.top-bar button'))

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
  expect(screen.getByText('GO! GO! GO!')).toBeInTheDocument()
})

test('reaction game waits up to five seconds before showing the tap signal', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.999)
  startRankingGameForExecution('reaction')

  await advanceGameCountdown()

  expect(screen.getByText('기다려주세요')).toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(4997)
  })
  expect(screen.queryByText('지금 누르세요!')).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(1)
  })
  expect(screen.getByText('지금 누르세요!')).toBeInTheDocument()
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
  expect(screen.getByText('0.123초')).toBeInTheDocument()
  expect(screen.getByText('아주 빠른 반응이에요!')).toBeInTheDocument()
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

  expect(screen.getAllByText('123ms').length).toBeGreaterThan(0)
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

  expect(screen.getByText('0.100초')).toBeInTheDocument()
  expect(screen.getByText('-0.20초')).toBeInTheDocument()
  expect(screen.getByText('1위')).toBeInTheDocument()
})

test('manual-start ranking games do not show the countdown overlay', () => {
  vi.useFakeTimers()
  startRankingGameForExecution('fiveSeconds')

  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('five-second-start')).toBeInTheDocument()
})

test('timing stop starts after the countdown finishes', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('timingStop')

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.queryByTestId('timing-stop')).not.toBeInTheDocument()

  await advanceGameCountdown()

  expect(screen.queryByTestId('game-countdown-overlay')).not.toBeInTheDocument()
  expect(screen.getByTestId('timing-stop')).toBeInTheDocument()
})

test('fast random game runs its draw animation and produces a settlement target', async () => {
  vi.useFakeTimers()
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-fastRandom'))
  fireEvent.click(screen.getByTestId('game-select-next'))
  fireEvent.click(screen.getByTestId('fast-random-draw'))

  expect(screen.getByTestId('fast-random-stage')).toHaveClass('drawing')

  await act(async () => {
    vi.advanceTimersByTime(2600)
  })

  expect(screen.getByTestId('random-result-name')).toBeInTheDocument()
  expect(screen.getByTestId('random-result-next')).toBeInTheDocument()
})

test('receipt envelope game requires selecting an envelope before revealing the result', () => {
  openGameSelectForExecution()

  fireEvent.click(screen.getByTestId('game-card-receiptEnvelope'))
  fireEvent.click(screen.getByTestId('game-select-next'))

  expect(screen.getByTestId('receipt-envelope-open')).toBeDisabled()
  fireEvent.click(screen.getByTestId('receipt-envelope-2'))
  expect(screen.getByTestId('receipt-envelope-2')).toHaveClass('selected-envelope')
  expect(screen.getByTestId('receipt-envelope-open')).not.toBeDisabled()

  fireEvent.click(screen.getByTestId('receipt-envelope-open'))
  expect(screen.getByTestId('random-result-name')).toBeInTheDocument()
  expect(screen.getByTestId('random-result-next')).toBeInTheDocument()
})

test('reaction game handles early tap and then records a measured reaction time', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  startRankingGameForExecution('reaction')
  await advanceGameCountdown()

  fireEvent.click(screen.getByTestId('reaction-action'))
  expect(screen.getByText('너무 빨랐어요!')).toBeInTheDocument()

  fireEvent.click(screen.getByTestId('reaction-reset'))
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))

  expect(screen.getByText('0.000초')).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

test('five second challenge measures the difference from five seconds', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('fiveSeconds')

  fireEvent.click(screen.getByTestId('five-second-start'))
  await act(async () => {
    vi.advanceTimersByTime(5200)
  })
  fireEvent.click(screen.getByTestId('five-second-stop'))

  expect(screen.getByText(/5.200/)).toBeInTheDocument()
  expect(screen.getByText(/0.200/)).toBeInTheDocument()
})

test('number order game adds mistake penalty to the final score', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('numberOrder')

  fireEvent.click(screen.getByTestId('number-start'))
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

  expect(screen.getByText(/mistakes: 1/)).toBeInTheDocument()
  expect(screen.getByText(/penalty/)).toBeInTheDocument()
})

test('moving target game counts hits during the timed round', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('movingTarget')

  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  fireEvent.click(screen.getByTestId('target-start'))
  expect(screen.getByTestId('complete-game-turn')).toBeDisabled()
  expect(screen.getByTestId('target-start')).toBeDisabled()

  fireEvent.pointerDown(screen.getAllByTestId('moving-target')[0])
  fireEvent.pointerDown(screen.getAllByTestId('moving-target')[0])

  expect(screen.getByText(/hits: 2/)).toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(5200)
  })

  expect(screen.getByText(/2 hits/)).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
  expect(screen.queryByTestId('target-start')).not.toBeInTheDocument()
})

test('memory card game completes real pairs and records attempts', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('memoryCard')

  expect(screen.getByTestId('game-countdown-overlay')).toBeInTheDocument()
  expect(screen.queryByText('Memorize')).not.toBeInTheDocument()

  await advanceGameCountdown()

  await act(async () => {
    vi.advanceTimersByTime(3100)
  })

  fireEvent.click(screen.getByTestId('memory-card-0'))
  fireEvent.click(screen.getByTestId('memory-card-3'))
  fireEvent.click(screen.getByTestId('memory-card-1'))
  fireEvent.click(screen.getByTestId('memory-card-5'))
  fireEvent.click(screen.getByTestId('memory-card-2'))
  fireEvent.click(screen.getByTestId('memory-card-4'))

  expect(screen.getByText(/attempts: 3/)).toBeInTheDocument()
  expect(screen.getByTestId('complete-game-turn')).not.toBeDisabled()
})

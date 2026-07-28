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

  for (const mode of ['똑같이 나누기', '한 명 면제', '한 명 더 내기', '차등 정산']) {
    expect(screen.getByRole('button', { name: new RegExp(mode) })).toBeInTheDocument()
  }

  fireEvent.click(screen.getByRole('button', { name: /똑같이 나누기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))

  expect(screen.getByRole('heading', { name: '게임 선택하기' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /룰렛 돌리기/ })).toBeInTheDocument()
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

test('tie for first place opens the rematch screen before final settlement', () => {
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

  expect(screen.getByRole('heading', { name: '동점 재대결' })).toBeInTheDocument()
  expect(screen.getByText(/민수, 지훈/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /민수 면제자로 확정/ }))
  expect(screen.getByRole('heading', { name: '게임 정산이 완료됐어요' })).toBeInTheDocument()
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
  startRankingGameForExecution('reaction')

  fireEvent.click(screen.getByTestId('reaction-action'))
  expect(screen.getByText('Too early')).toBeInTheDocument()

  fireEvent.click(screen.getByTestId('reaction-reset'))
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  fireEvent.click(screen.getByTestId('reaction-action'))

  expect(screen.getByText(/ms/)).toBeInTheDocument()
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

  fireEvent.click(screen.getByTestId('target-start'))
  fireEvent.pointerDown(screen.getAllByTestId('moving-target')[0])
  fireEvent.pointerDown(screen.getAllByTestId('moving-target')[0])

  expect(screen.getByText(/hits: 2/)).toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(5200)
  })

  expect(screen.getByText(/2 hits/)).toBeInTheDocument()
})

test('memory card game completes real pairs and records attempts', async () => {
  vi.useFakeTimers()
  startRankingGameForExecution('memoryCard')

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

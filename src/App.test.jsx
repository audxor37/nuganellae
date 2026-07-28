import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, test, vi } from 'vitest'
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait'
import App from './App'

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

function enterAmountWithQuickButton() {
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
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  expect(screen.getByRole('heading', { name: '면제 정산을 설정해 주세요' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  expect(screen.getByText('룰렛 돌리는 중')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /룰렛 돌리는 중/ })).toBeDisabled()
  expect(screen.queryByRole('heading', { name: /영희 님이 면제됐어요/ })).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })

  expect(screen.getByRole('heading', { name: '영희 님이 면제됐어요' })).toBeInTheDocument()
})

test('continues from roulette result to final result with share sheet', async () => {
  vi.useFakeTimers()
  renderApp()

  startSettlement()
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))

  await act(async () => {
    vi.advanceTimersByTime(2200)
  })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))

  expect(screen.getByRole('heading', { name: '정산이 완료됐어요' })).toBeInTheDocument()
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
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
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
      message: expect.stringContaining('누가낼래 정산 결과'),
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
      fileName: 'nuganellae-settlement-result.png',
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

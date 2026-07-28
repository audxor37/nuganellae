import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

test('renders the Stitch start screen copy and primary action', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: /오늘 정산, 재미있게 결정해요/ })).toBeInTheDocument()
  expect(screen.getByText('강남역 삼겹살 모임')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /정산 시작하기/ })).toBeInTheDocument()
})

test('moves through amount and participant entry', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: /정산 시작하기/ }))
  expect(screen.getByRole('heading', { name: '얼마를 나눌까요?' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))

  expect(screen.getByRole('heading', { name: '누가 함께했나요?' })).toBeInTheDocument()
  expect(screen.getByText('참여자 목록')).toBeInTheDocument()
  expect(screen.getByText('총 4명')).toBeInTheDocument()
})

test('selects exempt settlement and reaches final result with share sheet', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: /정산 시작하기/ }))
  fireEvent.click(screen.getByRole('button', { name: '+5만 원' }))
  fireEvent.click(screen.getByRole('button', { name: '+1만 원' }))
  fireEvent.click(screen.getByRole('button', { name: /참여자 입력하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /정산 방식 고르기/ }))
  fireEvent.click(screen.getByRole('button', { name: /한 명 면제/ }))
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기|결과 확인하기/ }))
  expect(screen.getByRole('heading', { name: '면제 정산을 설정해 주세요' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /게임 선택하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /룰렛 돌리기/ }))
  fireEvent.click(screen.getByRole('button', { name: /금액 확인하기/ }))

  expect(screen.getByRole('heading', { name: '정산이 완료됐어요' })).toBeInTheDocument()
  expect(screen.getByText('영희')).toBeInTheDocument()
  expect(screen.getByText('면제 (0원)')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /결과 공유하기/ }))
  const dialog = screen.getByRole('dialog', { name: '정산 결과 공유' })
  expect(within(dialog).getByText('토스로 공유')).toBeInTheDocument()
  expect(within(dialog).getByText('링크 복사')).toBeInTheDocument()
})

test('bottom navigation opens history and settings screens', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: '정산 내역' }))
  expect(screen.getByRole('heading', { name: '정산 내역' })).toBeInTheDocument()
  expect(screen.getByText('이번 달 보낸 정산금')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
  expect(screen.getByText('서비스 이용 안내')).toBeInTheDocument()
})

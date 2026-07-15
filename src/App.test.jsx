import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

test('renders the NugaNaellae start screen', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: '누가낼래' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '정산 시작하기' })).toBeInTheDocument()
})

test('moves from amount entry to participant entry', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: '정산 시작하기' }))
  fireEvent.change(screen.getByLabelText('총 금액'), { target: { value: '48000' } })
  fireEvent.click(screen.getByRole('button', { name: '참여자 입력하기' }))

  expect(screen.getByRole('heading', { name: '누가 함께했나요?' })).toBeInTheDocument()
  expect(screen.getByText('48,000원')).toBeInTheDocument()
})

test('generates a sample settlement result from the core flow', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: '정산 시작하기' }))
  fireEvent.change(screen.getByLabelText('총 금액'), { target: { value: '48000' } })
  fireEvent.click(screen.getByRole('button', { name: '참여자 입력하기' }))
  fireEvent.click(screen.getByRole('button', { name: '정산 방식 선택하기' }))
  fireEvent.click(screen.getByRole('button', { name: '게임으로 정하기' }))
  fireEvent.click(screen.getByRole('button', { name: '룰렛 돌리기' }))
  fireEvent.click(screen.getByRole('button', { name: '결과 보기' }))

  expect(screen.getByRole('heading', { name: '오늘은 누가 낼까요?' })).toBeInTheDocument()
  expect(screen.getByText(/1인 예상 금액/)).toBeInTheDocument()
  expect(screen.getByText('16,000원')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '다시 뽑기' })).toBeInTheDocument()
})

import { useMemo, useState } from 'react'

const screens = {
  start: 'start',
  amount: 'amount',
  participants: 'participants',
  settlement: 'settlement',
  game: 'game',
  drawing: 'drawing',
  result: 'result',
}

const starterParticipants = ['민준', '서연', '지호']

const settlementModes = [
  {
    id: 'equal',
    title: 'N분의 1 정산',
    description: '전체 금액을 모두에게 동일하게 나눠요.',
  },
  {
    id: 'exempt',
    title: '면제 정산',
    description: '한 명을 뽑고 나머지가 나눠 내는 흐름을 준비해요.',
  },
]

const gameModes = [
  {
    id: 'roulette',
    title: '룰렛',
    description: '가장 빠르게 오늘의 결제자를 정해요.',
    action: '룰렛 돌리기',
  },
  {
    id: 'quick',
    title: '빠른 랜덤',
    description: '한 번의 터치로 바로 결과를 만들어요.',
    action: '랜덤 뽑기',
  },
]

function formatWon(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function pickParticipant(participants) {
  const index = Math.floor(Math.random() * participants.length)
  return participants[index]
}

function buildResult({ amount, participants, settlementMode, gameMode }) {
  const payer = pickParticipant(participants)
  const perPerson = Math.ceil(Number(amount || 0) / participants.length)

  return {
    id: Date.now(),
    payer,
    perPerson,
    settlementMode,
    gameMode,
    createdAt: new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
  }
}

function App() {
  const [screen, setScreen] = useState(screens.start)
  const [amount, setAmount] = useState('')
  const [participants, setParticipants] = useState(starterParticipants)
  const [participantName, setParticipantName] = useState('')
  const [settlementMode, setSettlementMode] = useState('equal')
  const [gameMode, setGameMode] = useState('roulette')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  const selectedSettlement = settlementModes.find((mode) => mode.id === settlementMode)
  const selectedGame = gameModes.find((mode) => mode.id === gameMode)
  const canContinueAmount = Number(amount) > 0
  const canContinueParticipants = participants.length >= 2
  const perPersonPreview = useMemo(() => {
    if (!canContinueAmount || participants.length === 0) {
      return 0
    }

    return Math.ceil(Number(amount) / participants.length)
  }, [amount, canContinueAmount, participants.length])

  function addParticipant(event) {
    event.preventDefault()
    const nextName = participantName.trim()

    if (!nextName || participants.includes(nextName)) {
      setParticipantName('')
      return
    }

    setParticipants([...participants, nextName])
    setParticipantName('')
  }

  function removeParticipant(name) {
    if (participants.length <= 2) {
      return
    }

    setParticipants(participants.filter((participant) => participant !== name))
  }

  function createSampleResult() {
    const nextResult = buildResult({ amount, participants, settlementMode, gameMode })
    setResult(nextResult)
    setHistory([nextResult, ...history].slice(0, 3))
    setScreen(screens.result)
  }

  function restart() {
    setScreen(screens.start)
    setAmount('')
    setParticipants(starterParticipants)
    setParticipantName('')
    setSettlementMode('equal')
    setGameMode('roulette')
    setResult(null)
  }

  return (
    <main className="app">
      <div className="phone-shell">
        <header className="app-header">
          <button
            className="icon-button"
            type="button"
            aria-label="이전 화면"
            onClick={() => setScreen(screen === screens.start ? screens.start : screens.start)}
          >
            ←
          </button>
          <span className="brand-mark">누가낼래</span>
          <button className="icon-button" type="button" aria-label="설정">
            ⚙
          </button>
        </header>

        {screen === screens.start && (
          <section className="screen start-screen" aria-labelledby="app-title">
            <div className="hero-badge">NUGANAELLAE</div>
            <div className="coin-stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1 id="app-title">누가낼래</h1>
            <p className="screen-copy">
              밥값, 커피값, 회식비까지 빠르게 입력하고 게임처럼 가볍게 결제자를 정해요.
            </p>
            <div className="summary-card">
              <span>오늘의 샘플 플로우</span>
              <strong>금액 → 참여자 → 방식 → 게임 → 결과</strong>
            </div>
            <button className="primary-button" type="button" onClick={() => setScreen(screens.amount)}>
              정산 시작하기
            </button>
          </section>
        )}

        {screen === screens.amount && (
          <section className="screen" aria-labelledby="amount-title">
            <p className="step-label">STEP 1</p>
            <h1 id="amount-title">얼마를 정산할까요?</h1>
            <label className="field-label" htmlFor="amount">
              총 금액
            </label>
            <div className="amount-field">
              <input
                id="amount"
                inputMode="numeric"
                min="0"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="48000"
              />
              <span>원</span>
            </div>
            <div className="hint-card">
              <span>미리보기</span>
              <strong>{participants.length}명이 함께하면 {formatWon(perPersonPreview)}씩</strong>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!canContinueAmount}
              onClick={() => setScreen(screens.participants)}
            >
              참여자 입력하기
            </button>
          </section>
        )}

        {screen === screens.participants && (
          <section className="screen" aria-labelledby="participants-title">
            <div className="step-row">
              <p className="step-label">STEP 2</p>
              <strong className="amount-pill">{formatWon(amount)}</strong>
            </div>
            <h1 id="participants-title">누가 함께했나요?</h1>
            <form className="add-row" onSubmit={addParticipant}>
              <label className="sr-only" htmlFor="participant">
                참여자 이름
              </label>
              <input
                id="participant"
                type="text"
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="이름 추가"
              />
              <button className="secondary-button" type="submit">
                추가
              </button>
            </form>
            <ul className="participant-list">
              {participants.map((participant, index) => (
                <li key={participant}>
                  <span className="avatar">{participant.slice(0, 1)}</span>
                  <div>
                    <strong>{participant}</strong>
                    <small>{index + 1}번째 참여자</small>
                  </div>
                  <button type="button" onClick={() => removeParticipant(participant)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="primary-button"
              type="button"
              disabled={!canContinueParticipants}
              onClick={() => setScreen(screens.settlement)}
            >
              정산 방식 선택하기
            </button>
          </section>
        )}

        {screen === screens.settlement && (
          <section className="screen" aria-labelledby="settlement-title">
            <p className="step-label">STEP 3</p>
            <h1 id="settlement-title">어떻게 나눌까요?</h1>
            <div className="option-stack">
              {settlementModes.map((mode) => (
                <button
                  className={`option-card ${settlementMode === mode.id ? 'selected' : ''}`}
                  key={mode.id}
                  type="button"
                  onClick={() => setSettlementMode(mode.id)}
                >
                  <strong>{mode.title}</strong>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
            <button className="primary-button" type="button" onClick={() => setScreen(screens.game)}>
              게임으로 정하기
            </button>
          </section>
        )}

        {screen === screens.game && (
          <section className="screen" aria-labelledby="game-title">
            <p className="step-label">STEP 4 · {selectedSettlement.title}</p>
            <h1 id="game-title">결제자 뽑기 게임</h1>
            <div className="option-stack">
              {gameModes.map((mode) => (
                <button
                  className={`option-card ${gameMode === mode.id ? 'selected' : ''}`}
                  key={mode.id}
                  type="button"
                  onClick={() => setGameMode(mode.id)}
                >
                  <strong>{mode.title}</strong>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
            <button className="primary-button" type="button" onClick={() => setScreen(screens.drawing)}>
              {selectedGame.action}
            </button>
          </section>
        )}

        {screen === screens.drawing && (
          <section className="screen drawing-screen" aria-labelledby="drawing-title">
            <p className="step-label">READY</p>
            <h1 id="drawing-title">{selectedGame.title} 진행 중</h1>
            <div className="roulette" aria-hidden="true">
              {participants.map((participant) => (
                <span key={participant}>{participant.slice(0, 1)}</span>
              ))}
            </div>
            <p className="screen-copy">
              샘플 하네스에서는 버튼을 누르는 순간 참여자 중 한 명을 선택해 결과를 만듭니다.
            </p>
            <button className="primary-button" type="button" onClick={createSampleResult}>
              결과 보기
            </button>
          </section>
        )}

        {screen === screens.result && result && (
          <section className="screen result-screen" aria-labelledby="result-title">
            <p className="step-label">RESULT · {result.createdAt}</p>
            <h1 id="result-title">오늘은 누가 낼까요?</h1>
            <div className="winner-card">
              <span className="winner-avatar">{result.payer.slice(0, 1)}</span>
              <p>오늘의 결제자</p>
              <strong>{result.payer}</strong>
            </div>
            <div className="result-grid">
              <div>
                <span>총 금액</span>
                <strong>{formatWon(amount)}</strong>
              </div>
              <div>
                <span>1인 예상 금액</span>
                <strong>{formatWon(result.perPerson)}</strong>
              </div>
            </div>
            <div className="history-card">
              <span>최근 결과</span>
              {history.map((item) => (
                <p key={item.id}>
                  {item.payer} · {item.gameMode === 'roulette' ? '룰렛' : '빠른 랜덤'}
                </p>
              ))}
            </div>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setScreen(screens.drawing)}>
                다시 뽑기
              </button>
              <button className="primary-button compact" type="button" onClick={restart}>
                처음으로
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default App

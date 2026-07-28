import { useEffect, useMemo, useState } from 'react'
import { getTossShareLink, saveBase64Data, setClipboardText, share } from '@apps-in-toss/web-framework'
import { BottomCTA, BottomSheet, Button, IconButton, ListHeader, ListRow, SegmentedControl, Tab, TextField, Top, useWebToast } from '@toss/tds-mobile'

const tabs = {
  home: 'home',
  history: 'history',
  settings: 'settings',
}

const tabItems = [
  { id: tabs.home, icon: 'payments', label: '정산하기' },
  { id: tabs.history, icon: 'history', label: '정산 내역' },
  { id: tabs.settings, icon: 'settings', label: '설정' },
]

const steps = {
  start: 'start',
  amount: 'amount',
  participants: 'participants',
  method: 'method',
  exempt: 'exempt',
  roulette: 'roulette',
  rouletteResult: 'rouletteResult',
  finalResult: 'finalResult',
  detail: 'detail',
}

const baseParticipants = ['민수', '지훈', '수진', '영희']

const historyItems = [
  { id: 1, icon: 'restaurant', date: '7월 14일 | 저녁 식사', badge: '한 명 면제', amount: 84000, people: 4 },
  { id: 2, icon: 'local_cafe', date: '7월 10일 | 카페', badge: '똑같이 나누기', amount: 32000, people: 2 },
  { id: 3, icon: 'shopping_bag', date: '7월 08일 | 마트 장보기', badge: '금액별 나누기', amount: 115200, people: 3 },
  { id: 4, icon: 'sports_esports', date: '7월 02일 | PC방', badge: '정산 완료', amount: 17300, people: 2 },
]

const settlementModes = [
  { id: 'equal', icon: 'groups', title: '똑같이 나누기', description: '모두 같은 금액을 내요.' },
  { id: 'exempt', icon: 'person_off', title: '한 명 면제', description: '한 명을 뽑고 나머지가 나눠 내요.' },
  { id: 'extra', icon: 'add_card', title: '한 명 더 내기', description: '한 명이 정해진 금액을 조금 더 내요.' },
  { id: 'ratio', icon: 'pie_chart', title: '차등 정산', description: '각자 다른 비율로 나눠 내요.' },
]

const amountKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']

function formatWon(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function base64Encode(text) {
  return window.btoa(unescape(encodeURIComponent(text)))
}

function buildSharePayload({ amount, participants, splitAmount, winner }) {
  const paidParticipants = participants.filter((participant) => participant !== winner)
  const memberLines = participants.map((participant) => (
    `${participant}: ${participant === winner ? '면제 (0원)' : formatWon(splitAmount)}`
  ))

  return {
    amount,
    fileName: 'nuganellae-settlement-result.png',
    memberLines,
    paidParticipants,
    participants,
    splitAmount,
    title: '누가낼래 정산 결과',
    winner,
    message: [
      '누가낼래 정산 결과',
      `총 정산 금액: ${formatWon(amount)}`,
      `면제자: ${winner}`,
      `부담 인원: ${paidParticipants.length}명`,
      `1인당 금액: ${formatWon(splitAmount)}`,
      memberLines.join(' / '),
    ].join('\n'),
  }
}

function buildSettlementDeepLink(payload) {
  const params = new URLSearchParams({
    amount: String(payload.amount),
    splitAmount: String(payload.splitAmount),
    winner: payload.winner,
    participants: payload.participants.join(','),
  })

  return `intoss://nuganellae/settlement-result?${params.toString()}`
}

function buildReceiptSvg(payload) {
  const rows = payload.participants.map((participant, index) => {
    const amountText = participant === payload.winner ? '면제' : formatWon(payload.splitAmount)
    return `
      <text x="48" y="${230 + index * 38}" fill="#4e5968" font-size="22" font-weight="700">${participant}</text>
      <text x="452" y="${230 + index * 38}" fill="#191f28" font-size="22" font-weight="800" text-anchor="end">${amountText}</text>
    `
  }).join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="560" viewBox="0 0 500 560">
      <rect width="500" height="560" rx="36" fill="#f9fafb"/>
      <rect x="28" y="28" width="444" height="504" rx="28" fill="#ffffff"/>
      <circle cx="250" cy="96" r="34" fill="#e8f3ff"/>
      <text x="250" y="105" fill="#3182f6" font-size="34" font-weight="900" text-anchor="middle">₩</text>
      <text x="250" y="158" fill="#191f28" font-size="30" font-weight="900" text-anchor="middle">누가낼래 정산 결과</text>
      <text x="250" y="190" fill="#6b7684" font-size="18" font-weight="600" text-anchor="middle">총 ${formatWon(payload.amount)} · ${payload.winner} 님 면제</text>
      ${rows}
      <rect x="48" y="430" width="404" height="70" rx="18" fill="#f2f4f6"/>
      <text x="72" y="474" fill="#4e5968" font-size="20" font-weight="700">나머지 ${payload.paidParticipants.length}명이 각</text>
      <text x="428" y="474" fill="#3182f6" font-size="24" font-weight="900" text-anchor="end">${formatWon(payload.splitAmount)}</text>
    </svg>
  `
}

async function createSettlementImageBase64(payload) {
  const svg = buildReceiptSvg(payload)
  const fallbackBase64 = base64Encode(svg)

  if (typeof document === 'undefined' || navigator.userAgent.includes('jsdom')) {
    return fallbackBase64
  }

  const canvas = document.createElement('canvas')
  let context
  try {
    context = canvas.getContext?.('2d')
  } catch {
    context = null
  }

  if (context == null || typeof Image === 'undefined') {
    return fallbackBase64
  }

  canvas.width = 500
  canvas.height = 560

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''))
    }
    image.onerror = () => resolve(fallbackBase64)
    image.src = `data:image/svg+xml;base64,${fallbackBase64}`
  })
}

async function getSettlementShareLink(payload) {
  return getTossShareLink(buildSettlementDeepLink(payload))
}

async function copySettlementLink(payload) {
  const tossLink = await getSettlementShareLink(payload)

  try {
    await setClipboardText(tossLink)
  } catch {
    await navigator.clipboard?.writeText(tossLink)
  }

  return tossLink
}

function downloadBase64Image({ data, fileName }) {
  if (typeof document === 'undefined') {
    return
  }

  const link = document.createElement('a')
  link.href = `data:image/png;base64,${data}`
  link.download = fileName
  link.click()
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>
}

function TextStack({ title, description, meta }) {
  return (
    <span className="tds-text-stack">
      {meta && <small>{meta}</small>}
      <strong>{title}</strong>
      {description && <small>{description}</small>}
    </span>
  )
}

function TdsTitle({ title, subtitle, id, centered = false }) {
  return (
    <Top
      upperGap={0}
      lowerGap={12}
      title={<Top.TitleParagraph id={id} size={28}>{title}</Top.TitleParagraph>}
      subtitleBottom={subtitle ? <Top.SubtitleParagraph size={15}>{subtitle}</Top.SubtitleParagraph> : undefined}
      className={centered ? 'tds-top centered' : 'tds-top'}
    />
  )
}

function ScreenCTA({ children, onClick, disabled = false, color = 'primary', variant = 'fill', icon }) {
  return (
    <div className="screen-cta">
      <BottomCTA.Single
        background="none"
        color={color}
        disabled={disabled}
        onClick={onClick}
        variant={variant}
      >
        {icon && <Icon>{icon}</Icon>}
        {children}
      </BottomCTA.Single>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState(tabs.home)
  const [step, setStep] = useState(steps.start)
  const [amount, setAmount] = useState(0)
  const [participants, setParticipants] = useState(baseParticipants)
  const [newParticipant, setNewParticipant] = useState('')
  const [settlementMode, setSettlementMode] = useState('exempt')
  const [winner, setWinner] = useState('영희')
  const [shareOpen, setShareOpen] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [stepHistory, setStepHistory] = useState([])
  const [rouletteSpinning, setRouletteSpinning] = useState(false)

  const paidParticipants = useMemo(
    () => participants.filter((participant) => participant !== winner),
    [participants, winner],
  )
  const effectiveAmount = amount || 84000
  const splitAmount = Math.ceil(effectiveAmount / Math.max(1, paidParticipants.length))

  useEffect(() => {
    if (!rouletteSpinning) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      const nextWinner = participants.includes('영희') ? '영희' : participants[participants.length - 1]
      setWinner(nextWinner)
      setRouletteSpinning(false)
      navigateHomeStep(steps.rouletteResult)
    }, 2000)

    return () => window.clearTimeout(timerId)
  }, [participants, rouletteSpinning])

  function navigateHomeStep(nextStep, { resetHistory = false, replace = false } = {}) {
    setActiveTab(tabs.home)
    setShareOpen(false)
    if (nextStep !== steps.roulette) {
      setRouletteSpinning(false)
    }

    setStepHistory((history) => {
      if (resetHistory) {
        return []
      }

      if (replace || nextStep === step) {
        return history
      }

      return [...history, step]
    })
    setStep(nextStep)
  }

  function goHome(nextStep = steps.start) {
    navigateHomeStep(nextStep, { resetHistory: true })
  }

  function addAmount(value) {
    setAmount((current) => current + value)
  }

  function inputAmountKey(key) {
    if (key === 'backspace') {
      setAmount((current) => {
        const nextValue = String(current).slice(0, -1)
        return Number(nextValue || 0)
      })
      return
    }

    setAmount((current) => Number(`${current === 0 ? '' : current}${key}`))
  }

  function goPreviousHomeStep() {
    const previousStep = stepHistory[stepHistory.length - 1] || steps.start

    setActiveTab(tabs.home)
    setShareOpen(false)
    setRouletteSpinning(false)
    setStepHistory((history) => history.slice(0, -1))
    setStep(previousStep)
  }

  function handleParticipantSubmit(event) {
    event.preventDefault()
    const name = newParticipant.trim()

    if (!name || participants.includes(name)) {
      setNewParticipant('')
      return
    }

    setParticipants([...participants, name])
    setNewParticipant('')
  }

  function removeParticipant(name) {
    if (participants.length <= 2) {
      return
    }

    const nextParticipants = participants.filter((participant) => participant !== name)
    setParticipants(nextParticipants)
    if (winner === name) {
      setWinner(nextParticipants[nextParticipants.length - 1])
    }
  }

  function chooseMethod(mode) {
    setSettlementMode(mode)
    if (mode === 'exempt') {
      navigateHomeStep(steps.exempt)
      return
    }

    navigateHomeStep(steps.finalResult)
  }

  function spinRoulette() {
    setRouletteSpinning(true)
  }

  return (
    <main className="app">
      <section className="phone-shell" aria-label="누가낼래 앱">
        {activeTab === tabs.home && step !== steps.detail && (
          <TopBar
            title="누가낼래"
            progress={step === steps.start ? '1/3' : step === steps.amount ? '1/3' : step === steps.participants ? '2/3' : '3/3'}
            onBack={goPreviousHomeStep}
          />
        )}

        {activeTab === tabs.history && (
          <HistoryScreen filter={filter} onFilter={setFilter} onOpenDetail={() => setStep(steps.detail)} />
        )}

        {activeTab === tabs.settings && <SettingsScreen />}

        {activeTab === tabs.home && step === steps.start && <StartScreen onStart={() => navigateHomeStep(steps.amount)} />}
        {activeTab === tabs.home && step === steps.amount && (
          <AmountScreen amount={amount} onAddAmount={addAmount} onInputKey={inputAmountKey} onReset={() => setAmount(0)} onNext={() => navigateHomeStep(steps.participants)} />
        )}
        {activeTab === tabs.home && step === steps.participants && (
          <ParticipantsScreen
            newParticipant={newParticipant}
            participants={participants}
            onChangeName={setNewParticipant}
            onRemove={removeParticipant}
            onSubmit={handleParticipantSubmit}
            onNext={() => navigateHomeStep(steps.method)}
          />
        )}
        {activeTab === tabs.home && step === steps.method && (
          <MethodScreen selected={settlementMode} onSelect={setSettlementMode} onNext={() => chooseMethod(settlementMode)} />
        )}
        {activeTab === tabs.home && step === steps.exempt && (
          <ExemptScreen amount={effectiveAmount} people={participants.length} splitAmount={splitAmount} onNext={() => navigateHomeStep(steps.roulette)} />
        )}
        {activeTab === tabs.home && step === steps.roulette && (
          <RouletteScreen amount={effectiveAmount} participants={participants} spinning={rouletteSpinning} onSpin={spinRoulette} />
        )}
        {activeTab === tabs.home && step === steps.rouletteResult && (
          <RouletteResultScreen amount={effectiveAmount} splitAmount={splitAmount} winner={winner} onRetry={() => navigateHomeStep(steps.roulette)} onNext={() => navigateHomeStep(steps.finalResult)} />
        )}
        {activeTab === tabs.home && step === steps.finalResult && (
          <FinalResultScreen
            amount={effectiveAmount}
            participants={participants}
            splitAmount={splitAmount}
            winner={winner}
            onRestart={() => goHome(steps.amount)}
            onShare={() => setShareOpen(true)}
          />
        )}
        {activeTab === tabs.home && step === steps.detail && (
          <DetailScreen amount={84000} splitAmount={28000} winner="영희" onBack={() => setActiveTab(tabs.history)} onShare={() => setShareOpen(true)} />
        )}

        <BottomNav activeTab={activeTab} onNavigate={(tab) => {
          setActiveTab(tab)
          setShareOpen(false)
          setRouletteSpinning(false)
          setStepHistory([])
        }} />

        <ShareSheet
          amount={effectiveAmount}
          open={shareOpen}
          participants={participants}
          splitAmount={splitAmount}
          winner={winner}
          onClose={() => setShareOpen(false)}
        />
      </section>
    </main>
  )
}

function TopBar({ title, progress, onBack }) {
  return (
    <header className="top-bar">
      <IconButton
        aria-label="이전 화면"
        bgColor="transparent"
        src="https://static.toss.im/icons/svg/icon-arrow-left-mono.svg"
        variant="clear"
        onClick={onBack}
      />
      <strong>{title}</strong>
      <span className="progress-pill">{progress}</span>
    </header>
  )
}

function StartScreen({ onStart }) {
  return (
    <section className="screen start-screen" aria-labelledby="start-title">
      <TdsTitle
        centered
        id="start-title"
        title={<>오늘 정산,<br /><span>재미있게 결정해요</span></>}
        subtitle="금액과 참여자를 입력하면 각자 낼 금액을 계산해 드려요."
      />
      <div className="hero-illustration" aria-hidden="true">
        <div className="receipt-card">
          <span className="icon-bubble"><Icon>payments</Icon></span>
          <i />
          <i />
          <strong>₩ 15,000</strong>
        </div>
        <div className="receipt-shadow" />
      </div>
      <ListRow
        as="button"
        className="surface-row recent-row"
        left={<span className="icon-bubble muted"><Icon>history</Icon></span>}
        contents={<TextStack description="강남역 삼겹살 모임" meta="최근 정산 (7월 14일)" title="84,000원" />}
        right={<Icon>chevron_right</Icon>}
        type="button"
        withTouchEffect
      />
      <ScreenCTA icon="arrow_forward" onClick={onStart}>정산 시작하기</ScreenCTA>
    </section>
  )
}

function AmountScreen({ amount, onAddAmount, onInputKey, onReset, onNext }) {
  return (
    <section className="screen amount-screen" aria-labelledby="amount-title">
      <TdsTitle id="amount-title" subtitle="정산할 총 금액을 입력해 주세요." title="얼마를 나눌까요?" />
      <div className="amount-display" aria-live="polite">
        <strong>{formatWon(amount).replace('원', '')}</strong>
        <span>원</span>
      </div>
      <div className="quick-grid" aria-label="빠른 금액 입력">
        <Button color="primary" size="small" type="button" variant="weak" onClick={() => onAddAmount(10000)}>+1만 원</Button>
        <Button color="primary" size="small" type="button" variant="weak" onClick={() => onAddAmount(50000)}>+5만 원</Button>
        <Button color="primary" size="small" type="button" variant="weak" onClick={() => onAddAmount(100000)}>+10만 원</Button>
        <Button color="dark" size="small" type="button" variant="weak" onClick={onReset}>초기화</Button>
      </div>
      <div className="keypad" aria-label="금액 숫자 입력">
        {amountKeys.map((key) => (
          <button
            aria-label={key === 'backspace' ? '지우기' : key}
            className={key === 'backspace' ? 'keypad-key icon-key' : 'keypad-key'}
            key={key}
            type="button"
            onClick={() => onInputKey(key)}
          >
            {key === 'backspace' ? <Icon>backspace</Icon> : key}
          </button>
        ))}
      </div>
      <ScreenCTA disabled={amount <= 0} onClick={onNext}>참여자 입력하기</ScreenCTA>
    </section>
  )
}

function ParticipantsScreen({ participants, newParticipant, onChangeName, onSubmit, onRemove, onNext }) {
  return (
    <section className="screen participants-screen" aria-labelledby="participants-title">
      <TdsTitle id="participants-title" subtitle="정산에 참여할 멤버들을 추가해주세요." title="누가 함께했나요?" />
      <form className="participant-form" onSubmit={onSubmit}>
        <TextField
          label="참여자 이름"
          labelOption="sustain"
          placeholder="이름 입력"
          right={<Button color="primary" size="small" type="submit">추가</Button>}
          value={newParticipant}
          variant="box"
          onChange={(event) => onChangeName(event.target.value)}
        />
      </form>
      <ListHeader
        className="compact-list-header"
        title={<ListHeader.TitleParagraph>참여자 목록</ListHeader.TitleParagraph>}
        right={<ListHeader.RightText>총 {participants.length}명</ListHeader.RightText>}
      />
      <ul className="tds-list member-list">
        {participants.map((participant) => (
          <ListRow
            className="surface-row"
            key={participant}
            left={<span className="avatar">{participant.slice(0, 1)}</span>}
            contents={<TextStack title={participant} />}
            right={(
              <Button color="dark" size="small" type="button" variant="weak" onClick={() => onRemove(participant)}>
                삭제
              </Button>
            )}
          />
        ))}
      </ul>
      <div className="tip-card"><Icon>lightbulb</Icon> 자주 함께하는 친구들을 '즐겨찾기'에서 불러올 수 있습니다.</div>
      <ScreenCTA icon="chevron_right" onClick={onNext}>정산 방식 고르기</ScreenCTA>
    </section>
  )
}

function MethodScreen({ selected, onSelect, onNext }) {
  return (
    <section className="screen method-screen" aria-labelledby="method-title">
      <TdsTitle id="method-title" subtitle="원하시는 정산 방식을 선택해 주세요." title="어떻게 나눌까요?" />
      <SegmentedControl alignment="fluid" value={selected} onChange={onSelect}>
        {settlementModes.map((mode) => (
          <SegmentedControl.Item key={mode.id} value={mode.id}>{mode.title}</SegmentedControl.Item>
        ))}
      </SegmentedControl>
      <ul className="tds-list method-list">
        {settlementModes.map((mode) => (
          <ListRow
            as="button"
            className={selected === mode.id ? 'surface-row selected-row' : 'surface-row'}
            key={mode.id}
            left={<span className="icon-bubble"><Icon>{mode.icon}</Icon></span>}
            contents={<TextStack description={mode.description} title={mode.title} />}
            right={<Icon>{selected === mode.id ? 'check_circle' : 'circle'}</Icon>}
            type="button"
            withTouchEffect
            onClick={() => onSelect(mode.id)}
          />
        ))}
      </ul>
      <div className="info-card"><Icon>info</Icon> 선택한 방식에 따라 정산 결과가 자동으로 계산되어 전송됩니다.</div>
      <ScreenCTA icon="arrow_forward" onClick={onNext}>{selected === 'exempt' ? '게임 선택하기' : '결과 확인하기'}</ScreenCTA>
    </section>
  )
}

function ExemptScreen({ amount, people, splitAmount, onNext }) {
  return (
    <section className="screen exempt-screen" aria-labelledby="exempt-title">
      <TdsTitle id="exempt-title" subtitle="한 명을 무작위로 선택하고, 나머지 인원이 금액을 나눠 냅니다." title="면제 정산을 설정해 주세요" />
      <div className="summary-banner">
        <span>총 정산 금액</span>
        <strong>{formatWon(amount)}</strong>
        <Icon>payments</Icon>
      </div>
      <div className="option-panel">
        <div>
          <small>참여자</small>
          <strong>{people}명</strong>
        </div>
        <div>
          <small>면제 방식</small>
          <strong><Icon>casino</Icon> 랜덤 1명</strong>
        </div>
        <div className="mini-people">
          <span>person</span><span>person</span><span>person</span><Icon>check_circle</Icon>
        </div>
      </div>
      <label className="toggle-row">
        <input type="checkbox" defaultChecked />
        <span><Icon>auto_awesome</Icon> 결과 재선택 허용</span>
        <small>결과가 마음에 안 들면 다시 돌릴 수 있어요.</small>
      </label>
      <div className="preview-card">
        <strong><Icon>analytics</Icon> 예상 결과 미리보기</strong>
        <p>면제 1명 0원</p>
        <p>나머지 {people - 1}명 (각) 약 {formatWon(splitAmount)}</p>
      </div>
      <ScreenCTA icon="play_arrow" onClick={onNext}>게임 선택하기</ScreenCTA>
    </section>
  )
}

function RouletteScreen({ amount, participants, spinning, onSpin }) {
  return (
    <section className="screen roulette-screen" aria-labelledby="roulette-title">
      <TdsTitle centered id="roulette-title" subtitle={spinning ? '잠시만 기다려 주세요. 면제자를 고르고 있어요.' : '버튼을 눌러 결과를 확인해 보세요.'} title="오늘의 정산 결과는?" />
      <div className="roulette-stage">
        <div className="roulette-pointer" aria-hidden="true"><Icon>arrow_drop_down</Icon></div>
        <div
          className={spinning ? 'roulette-wheel spinning' : 'roulette-wheel'}
          aria-label={`${participants.join(', ')} 룰렛`}
          style={{ '--participant-count': participants.length }}
        >
          <div className="roulette-core">
            <Icon>{spinning ? 'sync' : 'casino'}</Icon>
            <strong>{spinning ? '선택 중' : 'READY'}</strong>
          </div>
          {participants.map((participant, index) => (
            <span key={participant} style={{ '--slot': index }}>{participant}</span>
          ))}
        </div>
      </div>
      <div className="roulette-summary">
        <span>총 결제 금액</span>
        <strong>{formatWon(amount)}</strong>
      </div>
      <div className="roulette-members">
        {participants.map((participant) => <span key={participant}>{participant}</span>)}
      </div>
      <ScreenCTA disabled={spinning} icon={spinning ? 'sync' : 'refresh'} onClick={onSpin}>{spinning ? '룰렛 돌리는 중' : '룰렛 돌리기'}</ScreenCTA>
    </section>
  )
}

function RouletteResultScreen({ amount, splitAmount, winner, onRetry, onNext }) {
  return (
    <section className="screen roulette-result-screen" aria-labelledby="roulette-result-title">
      <span className="result-kicker">면제 확정</span>
      <TdsTitle centered id="roulette-result-title" subtitle={`나머지 세 명이 ${formatWon(splitAmount)}씩 나눠 내요.`} title={`${winner} 님이 면제됐어요`} />
      <div className="winner-orb">{winner.slice(0, 1)}</div>
      <div className="result-stats">
        <div><small>결제 총액</small><strong>{formatWon(amount)}</strong><Icon>receipt_long</Icon></div>
        <div><small>면제자</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>1인당 금액</small><strong>{formatWon(splitAmount)}</strong></div>
      </div>
      <div className="button-row">
        <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</Button>
        <Button color="primary" display="full" size="large" type="button" onClick={onNext}>금액 확인하기</Button>
      </div>
    </section>
  )
}

function FinalResultScreen({ amount, participants, splitAmount, winner, onRestart, onShare }) {
  return (
    <section className="screen final-screen" aria-labelledby="final-title">
      <div className="success-icon"><Icon>check_circle</Icon></div>
      <TdsTitle centered id="final-title" subtitle="총 정산 금액" title="정산이 완료됐어요" />
      <strong className="big-amount">{formatWon(amount)}</strong>
      <span className="mode-badge"><Icon>casino</Icon> 한 명 면제 방식 적용</span>
      <ListHeader
        className="compact-list-header"
        title={<ListHeader.TitleParagraph>참여자별 금액</ListHeader.TitleParagraph>}
      />
      <ul className="tds-list result-list">
        {participants.map((participant) => (
          <ListRow
            className={participant === winner ? 'surface-row exempted' : 'surface-row'}
            key={participant}
            left={<span className="avatar">{participant.slice(0, 1)}</span>}
            contents={<TextStack description={participant === winner ? '면제 (0원)' : formatWon(splitAmount)} title={participant} />}
            right={<Button color="dark" size="small" type="button" variant="weak">수정</Button>}
          />
        ))}
      </ul>
      <div className="celebration-card"><Icon>celebration</Icon> 운 좋게 {winner} 님이 면제자로 선정되었어요! 남은 인원이 각 {formatWon(splitAmount)}씩 부담합니다.</div>
      <div className="button-row">
        <Button color="primary" display="full" size="large" type="button" variant="weak"><Icon>image</Icon> 이미지로 저장</Button>
        <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRestart}><Icon>refresh</Icon> 새로운 정산</Button>
      </div>
      <ScreenCTA icon="share" onClick={onShare}>결과 공유하기</ScreenCTA>
    </section>
  )
}

function HistoryScreen({ filter, onFilter, onOpenDetail }) {
  return (
    <>
      <TopBar title="정산 내역" progress="2024년 7월" onBack={() => {}} />
      <section className="screen history-screen" aria-labelledby="history-title">
        <h1 className="sr-only">정산 내역</h1>
        <div className="monthly-card">
          <span>이번 달 보낸 정산금</span>
          <h1 id="history-title">248,500원</h1>
          <p><b>총 12건</b><b>3명과 공유</b></p>
        </div>
        <SegmentedControl alignment="fluid" value={filter} onChange={onFilter}>
          {['전체', '보낸 정산', '받을 정산'].map((item) => (
            <SegmentedControl.Item key={item} value={item}>{item}</SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <ul className="tds-list history-list">
          {historyItems.map((item) => (
            <ListRow
              as="button"
              className="surface-row history-row"
              key={item.id}
              left={<span className="icon-bubble"><Icon>{item.icon}</Icon></span>}
              contents={<TextStack description={formatWon(item.amount)} meta={item.date} title={item.badge} />}
              right={<small>{item.people}명 참여</small>}
              type="button"
              withArrow
              withTouchEffect
              onClick={onOpenDetail}
            />
          ))}
        </ul>
        <div className="state-grid">
          <span>로딩: 정산 내역을 불러오는 중</span>
          <span>빈 화면: 아직 정산 내역이 없어요</span>
          <span>오류: 내역을 다시 불러와 주세요</span>
        </div>
      </section>
    </>
  )
}

function DetailScreen({ amount, splitAmount, winner, onBack, onShare }) {
  return (
    <>
      <TopBar title="상세 내역" progress="1/3" onBack={onBack} />
      <section className="screen detail-screen" aria-labelledby="detail-title">
        <TdsTitle id="detail-title" subtitle="어제 저녁 즐거웠던 모임 기록" title="삼겹살 회식 정산" />
        <div className="summary-banner"><span>총 결제 금액</span><strong>{formatWon(amount)}</strong><Icon>auto_awesome</Icon></div>
        <div className="detail-meta"><span><Icon>groups</Icon> 참여자 총 4명</span><span>방식 한 명 면제</span></div>
        <ul className="tds-list result-list">
          {['민수', '지훈', '수진', winner].map((participant) => (
            <ListRow
              className={participant === winner ? 'surface-row exempted' : 'surface-row'}
              key={participant}
              left={<span className="avatar">{participant.slice(0, 1)}</span>}
              contents={<TextStack description={participant === winner ? '면제 당첨!' : participant === '지훈' ? '입금 대기' : '입금 완료'} title={participant} />}
              right={<b>{participant === winner ? '0원' : formatWon(splitAmount)}</b>}
            />
          ))}
        </ul>
        <blockquote>"{winner}님의 운이 폭발했던 그 날!"<br />총 1명의 면제자가 선정되었습니다.</blockquote>
        <Button color="danger" display="full" size="large" type="button"><Icon>delete</Icon> 정산 내역 삭제</Button>
        <ScreenCTA icon="share" onClick={onShare}>결과 다시 공유하기</ScreenCTA>
      </section>
    </>
  )
}

function SettingsScreen() {
  return (
    <>
      <TopBar title="설정" progress="1/3" onBack={() => {}} />
      <section className="screen settings-screen" aria-labelledby="settings-title">
        <h1 className="sr-only">설정</h1>
        <div className="profile-card">
          <span className="avatar">사</span>
          <strong id="settings-title">사용자님</strong>
          <p>settle-user@example.com</p>
        </div>
        <ListHeader
          className="compact-list-header"
          title={<ListHeader.TitleParagraph>일반</ListHeader.TitleParagraph>}
        />
        <ul className="tds-list">
          <SettingsRow icon="help" title="서비스 이용 안내" />
          <SettingsRow danger description="삭제된 데이터는 복구할 수 없습니다" icon="warning" title="정산 내역 전체 삭제" />
        </ul>
        <ListHeader
          className="compact-list-header"
          title={<ListHeader.TitleParagraph>약관 및 지원</ListHeader.TitleParagraph>}
        />
        <ul className="tds-list">
          <SettingsRow icon="privacy_tip" title="개인정보 처리방침" />
          <SettingsRow icon="article" title="서비스 이용약관" />
          <SettingsRow icon="mail" title="문의하기" />
        </ul>
        <div className="info-card">
          <Icon>info</Icon>
          <span>누가낼래 앱 버전 v1.0.0</span>
          <small>'누가낼래'는 공정한 비용 분담을 돕는 유틸리티 서비스입니다. 본 서비스는 도박 또는 사행성 행위를 조장하지 않으며, 건전한 소비 문화를 지향합니다.</small>
        </div>
      </section>
    </>
  )
}

function SettingsRow({ icon, title, description, danger = false }) {
  return (
    <ListRow
      as="button"
      className={danger ? 'surface-row danger-row' : 'surface-row'}
      left={<span className="icon-bubble"><Icon>{icon}</Icon></span>}
      contents={<TextStack description={description} title={title} />}
      type="button"
      withArrow
      withTouchEffect
    />
  )
}

function ShareSheet({ amount, open, participants, splitAmount, winner, onClose }) {
  const { openToast } = useWebToast({ exitOnUnmount: false })
  const [shareActionPending, setShareActionPending] = useState(null)
  const payload = buildSharePayload({ amount, participants, splitAmount, winner })

  async function runShareAction(action, successMessage, errorMessage) {
    setShareActionPending(action)
    try {
      await action()
      openToast(successMessage, { duration: 1800 })
    } catch {
      openToast(errorMessage, { duration: 2200 })
    } finally {
      setShareActionPending(null)
    }
  }

  function handleTossShare() {
    return runShareAction(async () => {
      const tossLink = await getSettlementShareLink(payload)
      await share({ message: `${payload.message}\n${tossLink}` })
    }, '토스 공유창을 열었어요.', '토스 공유를 열지 못했어요.')
  }

  function handleCopyLink() {
    return runShareAction(async () => {
      await copySettlementLink(payload)
    }, '정산 링크를 복사했어요.', '링크를 복사하지 못했어요.')
  }

  function handleSaveImage() {
    return runShareAction(async () => {
      const data = await createSettlementImageBase64(payload)

      try {
        await saveBase64Data({
          data,
          fileName: payload.fileName,
          mimeType: 'image/png',
        })
      } catch {
        downloadBase64Image({ data, fileName: payload.fileName })
      }
    }, '정산 이미지를 저장했어요.', '이미지를 저장하지 못했어요.')
  }

  function handleKakaoShare() {
    return runShareAction(async () => {
      const tossLink = await getSettlementShareLink(payload)
      await share({ message: `카카오톡으로 공유해 주세요.\n${payload.message}\n${tossLink}` })
    }, '공유창에서 카카오톡을 선택해 주세요.', '카카오톡 공유를 열지 못했어요.')
  }

  const shareActions = [
    ['payments', '토스로 공유', handleTossShare],
    ['link', '링크 복사', handleCopyLink],
    ['download', '이미지 저장', handleSaveImage],
    ['send', '카카오톡으로 바로 보내기', handleKakaoShare],
  ]

  return (
    <BottomSheet
      UNSAFE_disableFocusLock
      ariaLabelledBy="share-title"
      className="tds-share-sheet"
      header={<BottomSheet.Header><span id="share-title">정산 결과 공유하기</span></BottomSheet.Header>}
      headerDescription={<BottomSheet.HeaderDescription>토스 공유, 링크 복사, 이미지 저장 중 원하는 방식을 선택하세요.</BottomSheet.HeaderDescription>}
      open={open}
      onClose={onClose}
      onDimmerClick={onClose}
      cta={<BottomSheet.CTA aria-label="공유창 닫기" onClick={onClose}>닫기</BottomSheet.CTA>}
    >
      <section aria-label="정산 결과 공유" role="dialog">
        <div className="share-preview">
          <strong>누가낼래</strong>
          <small>2024년 5월 24일 4인 모임</small>
          <p>총 정산 금액</p>
          <b>₩{amount.toLocaleString('ko-KR')}</b>
          <span>+{Math.max(0, participants.length - 1)}</span>
        </div>
        <div className="share-members">
          {participants.slice(0, 2).map((participant) => (
            <span key={participant}>{participant} {participant === winner ? '면제' : formatWon(splitAmount)}</span>
          ))}
        </div>
        <div className="share-actions">
          {shareActions.map(([icon, label, onClick]) => (
            <Button
              color="dark"
              disabled={shareActionPending != null}
              display="full"
              key={label}
              size="large"
              type="button"
              variant="weak"
              onClick={onClick}
            >
              <Icon>{shareActionPending === onClick ? 'sync' : icon}</Icon>
              {label}
            </Button>
          ))}
        </div>
      </section>
    </BottomSheet>
  )
}

function BottomNav({ activeTab, onNavigate }) {
  const selectedIndex = tabItems.findIndex((item) => item.id === activeTab)

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <Tab
        ariaLabel="주요 메뉴"
        size="small"
        onChange={(index) => onNavigate(tabItems[index].id)}
      >
        {tabItems.map((item, index) => (
          <Tab.Item key={item.id} selected={selectedIndex === index}>
            <button aria-label={item.label} className="bottom-tab-button" type="button">
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
            </button>
          </Tab.Item>
        ))}
      </Tab>
    </nav>
  )
}

export default App

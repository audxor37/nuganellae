import { useEffect, useMemo, useRef, useState } from 'react'
import { getTossShareLink, saveBase64Data, setClipboardText, share } from '@apps-in-toss/web-framework'
import { BottomCTA, BottomSheet, Button, IconButton, ListHeader, ListRow, SegmentedControl, Tab, TextField, Top, useWebToast } from '@toss/tds-mobile'
import settlementCompleteImage from './assets/settlement-complete.jpg'

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
  title: 'title',
  amount: 'amount',
  participants: 'participants',
  method: 'method',
  exempt: 'exempt',
  gameSelect: 'gameSelect',
  gameRules: 'gameRules',
  playOrder: 'playOrder',
  participantTurn: 'participantTurn',
  gamePlay: 'gamePlay',
  rankingResult: 'rankingResult',
  tieRematch: 'tieRematch',
  roulette: 'roulette',
  rouletteResult: 'rouletteResult',
  finalResult: 'finalResult',
  gameFinalResult: 'gameFinalResult',
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

const gameCatalog = [
  { id: 'roulette', category: 'random', icon: 'published_with_changes', title: '룰렛 돌리기', badge: '기본', description: '선택한 정산 방식에 맞춰 무작위 대상자를 뽑아요.', rule: '룰렛을 돌리면 선택한 정산 방식에 따라 결과가 적용돼요.' },
  { id: 'fastRandom', category: 'random', icon: 'bolt', title: '빠른 랜덤 뽑기', badge: '빠른 결정', description: '버튼 한 번으로 빠르게 대상자를 정해요.', rule: '참여자 중 한 명을 즉시 뽑아 정산 방식에 적용해요.' },
  { id: 'receiptEnvelope', category: 'random', icon: 'drafts', title: '영수증 봉투 뽑기', badge: '추천 게임', description: '봉투를 골라 숨겨진 정산 결과를 확인해요.', rule: '봉투 안에 들어있는 이름을 뽑아 정산 방식에 적용해요.' },
  { id: 'reaction', category: 'ranking', icon: 'flash_on', title: '반응속도 대결', badge: '순위 게임', description: '신호가 뜨면 가장 빠르게 눌러요.', rule: '신호 후 클릭까지 걸린 시간이 짧을수록 높은 순위예요.' },
  { id: 'fiveSeconds', category: 'ranking', icon: 'timer', title: '딱 5초 챌린지', badge: '순위 게임', description: '5초에 가장 가깝게 멈춰요.', rule: '5.000초와의 차이가 작을수록 높은 순위예요.' },
  { id: 'timingStop', category: 'ranking', icon: 'speed', title: '타이밍 멈추기', badge: '순위 게임', description: '움직이는 게이지를 목표 구간에 멈춰요.', rule: '목표 중앙에 가까울수록 높은 순위예요.' },
  { id: 'numberOrder', category: 'ranking', icon: 'pin', title: '숫자 순서대로 누르기', badge: '순위 게임', description: '숨어 있는 숫자를 순서대로 눌러요.', rule: '완료 시간이 짧고 실수가 적을수록 높은 순위예요.' },
  { id: 'movingTarget', category: 'ranking', icon: 'my_location', title: '움직이는 표적 맞히기', badge: '순위 게임', description: '움직이는 표적을 제한 시간 안에 맞혀요.', rule: '맞힌 표적 수가 많을수록 높은 순위예요.' },
  { id: 'memoryCard', category: 'ranking', icon: 'style', title: '기억력 카드 게임', badge: '순위 게임', description: '같은 그림의 카드를 빠르게 찾아요.', rule: '완료 시간이 짧고 시도 수가 적을수록 높은 순위예요.' },
]

const amountKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']

function formatWon(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function base64Encode(text) {
  return window.btoa(unescape(encodeURIComponent(text)))
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function sanitizeFileName(title) {
  const cleanedTitle = String(title || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')

  return cleanedTitle ? `${cleanedTitle}.png` : 'nuganellae-settlement-result.png'
}

function buildSharePayload({ amount, participants, settlementTitle, splitAmount, winner }) {
  const title = settlementTitle.trim()
  const paidParticipants = participants.filter((participant) => participant !== winner)
  const memberLines = participants.map((participant) => (
    `${participant}: ${participant === winner ? '면제 (0원)' : formatWon(splitAmount)}`
  ))

  return {
    amount,
    fileName: sanitizeFileName(title),
    memberLines,
    paidParticipants,
    participants,
    splitAmount,
    title,
    winner,
    message: [
      title,
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
      <text x="250" y="158" fill="#191f28" font-size="30" font-weight="900" text-anchor="middle">${escapeSvgText(payload.title)}</text>
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

function ScreenCTA({ children, onClick, disabled = false, color = 'primary', variant = 'fill', icon, testId }) {
  return (
    <div className="screen-cta">
      <BottomCTA.Single
        background="none"
        color={color}
        data-testid={testId}
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

function getGameScoreLabel(game, score) {
  if (game.id === 'movingTarget') {
    return `${score.rawScore}점`
  }

  if (game.id === 'fiveSeconds') {
    return `${score.displayScore}초`
  }

  return `${score.displayScore}ms`
}

function buildGameScore({ gameId, participant, index }) {
  const scoreTable = {
    reaction: [218, 287, 346, 412],
    fiveSeconds: [5, 5, 5.37, 4.41],
    timingStop: [8, 19, 27, 35],
    numberOrder: [1240, 1510, 1690, 1810],
    movingTarget: [9, 7, 6, 5],
    memoryCard: [18, 22, 25, 29],
  }
  const rawScore = scoreTable[gameId]?.[index] ?? (300 + index * 60)
  const lowerIsBetter = gameId !== 'movingTarget'
  const rankMetric = gameId === 'fiveSeconds'
    ? Math.abs(rawScore - 5)
    : lowerIsBetter ? rawScore : -rawScore

  return {
    participant,
    gameId,
    metric: rankMetric,
    rawScore,
    displayScore: Number(rawScore).toLocaleString('ko-KR', {
      maximumFractionDigits: gameId === 'fiveSeconds' ? 3 : 0,
      minimumFractionDigits: gameId === 'fiveSeconds' ? 3 : 0,
    }),
    rankMetric,
  }
}

function createMeasuredGameScore({ detail = {}, displayScore, gameId, metric, participant, rawScore }) {
  return {
    detail,
    displayScore: String(displayScore),
    gameId,
    metric,
    participant,
    rankMetric: metric,
    rawScore,
  }
}

function getRankedScores(scores) {
  const sortedScores = [...scores].sort((a, b) => a.rankMetric - b.rankMetric)
  let previousMetric = null
  let currentRank = 0

  return sortedScores.map((score, index) => {
    if (score.rankMetric !== previousMetric) {
      currentRank = index + 1
      previousMetric = score.rankMetric
    }

    return { ...score, rank: currentRank }
  })
}

function App() {
  const [activeTab, setActiveTab] = useState(tabs.home)
  const [step, setStep] = useState(steps.start)
  const [settlementTitle, setSettlementTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [participants, setParticipants] = useState(baseParticipants)
  const [newParticipant, setNewParticipant] = useState('')
  const [settlementMode, setSettlementMode] = useState('exempt')
  const [winner, setWinner] = useState('영희')
  const [shareOpen, setShareOpen] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [stepHistory, setStepHistory] = useState([])
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState('roulette')
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [gameScores, setGameScores] = useState([])

  const paidParticipants = useMemo(
    () => participants.filter((participant) => participant !== winner),
    [participants, winner],
  )
  const effectiveAmount = amount || 84000
  const splitAmount = Math.ceil(effectiveAmount / Math.max(1, paidParticipants.length))
  const canProceedFromTitle = settlementTitle.trim().length > 0
  const selectedGame = gameCatalog.find((game) => game.id === selectedGameId) || gameCatalog[0]
  const rankedScores = useMemo(() => getRankedScores(gameScores, selectedGame), [gameScores, selectedGame])
  const firstPlaceScores = rankedScores.filter((score) => score.rank === 1)

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

  function restartSettlement() {
    setSettlementTitle('')
    setAmount(0)
    goHome(steps.title)
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

    navigateHomeStep(steps.gameSelect)
  }

  function spinRoulette() {
    setRouletteSpinning(true)
  }

  function resetGameProgress() {
    setCurrentPlayerIndex(0)
    setGameScores([])
  }

  function startSelectedGame() {
    resetGameProgress()
    if (selectedGame.category === 'random') {
      if (selectedGame.id === 'roulette') {
        navigateHomeStep(steps.roulette)
        return
      }

      navigateHomeStep(steps.gamePlay)
      return
    }

    navigateHomeStep(steps.gameRules)
  }

  function startParticipantTurn(index = currentPlayerIndex) {
    setCurrentPlayerIndex(index)
    navigateHomeStep(steps.gamePlay)
  }

  function completeRandomGame(selectedParticipant) {
    setWinner(selectedParticipant)
    navigateHomeStep(steps.rouletteResult)
  }

  function completeGameTurn(measuredScore) {
    const participant = participants[currentPlayerIndex]
    const nextScores = [
      ...gameScores,
      measuredScore || buildGameScore({ gameId: selectedGame.id, participant, index: currentPlayerIndex }),
    ]

    setGameScores(nextScores)

    if (currentPlayerIndex < participants.length - 1) {
      setCurrentPlayerIndex((index) => index + 1)
      navigateHomeStep(steps.participantTurn)
      return
    }

    const ranked = getRankedScores(nextScores, selectedGame)
    const leaders = ranked.filter((score) => score.rank === 1)
    if (leaders.length > 1) {
      navigateHomeStep(steps.tieRematch)
      return
    }

    setWinner(leaders[0].participant)
    navigateHomeStep(steps.rankingResult)
  }

  function confirmGameWinner(participant) {
    setWinner(participant)
    navigateHomeStep(steps.gameFinalResult)
  }

  return (
    <main className="app">
      <section className="phone-shell" aria-label="누가낼래 앱">
        {activeTab === tabs.home && step !== steps.detail && (
          <TopBar
            title="누가낼래"
            progress={step === steps.start ? '1/4' : step === steps.title ? '1/4' : step === steps.amount ? '2/4' : step === steps.participants ? '3/4' : '4/4'}
            onBack={goPreviousHomeStep}
          />
        )}

        {activeTab === tabs.history && (
          <HistoryScreen filter={filter} onFilter={setFilter} onOpenDetail={() => setStep(steps.detail)} />
        )}

        {activeTab === tabs.settings && <SettingsScreen />}

        {activeTab === tabs.home && step === steps.start && <StartScreen onStart={() => navigateHomeStep(steps.title)} />}
        {activeTab === tabs.home && step === steps.title && (
          <TitleScreen
            title={settlementTitle}
            onChangeTitle={setSettlementTitle}
            onNext={() => {
              if (canProceedFromTitle) {
                navigateHomeStep(steps.amount)
              }
            }}
          />
        )}
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
          <ExemptScreen amount={effectiveAmount} people={participants.length} splitAmount={splitAmount} onNext={() => navigateHomeStep(steps.gameSelect)} />
        )}
        {activeTab === tabs.home && step === steps.gameSelect && (
          <GameSelectScreen
            games={gameCatalog}
            selectedGameId={selectedGameId}
            settlementMode={settlementMode}
            onSelect={setSelectedGameId}
            onNext={startSelectedGame}
          />
        )}
        {activeTab === tabs.home && step === steps.gameRules && (
          <GameRulesScreen game={selectedGame} onNext={() => navigateHomeStep(steps.playOrder)} />
        )}
        {activeTab === tabs.home && step === steps.playOrder && (
          <PlayOrderScreen participants={participants} onNext={() => navigateHomeStep(steps.participantTurn)} />
        )}
        {activeTab === tabs.home && step === steps.participantTurn && (
          <ParticipantTurnScreen participant={participants[currentPlayerIndex]} progress={`${currentPlayerIndex + 1}/${participants.length}`} onNext={() => startParticipantTurn(currentPlayerIndex)} />
        )}
        {activeTab === tabs.home && step === steps.gamePlay && (
          selectedGame.category === 'random'
            ? <RandomGameScreen game={selectedGame} participants={participants} onComplete={completeRandomGame} />
            : <RankingGameScreen game={selectedGame} participant={participants[currentPlayerIndex]} playerIndex={currentPlayerIndex} onComplete={completeGameTurn} />
        )}
        {activeTab === tabs.home && step === steps.rankingResult && (
          <RankingResultScreen game={selectedGame} scores={rankedScores} onNext={() => confirmGameWinner(firstPlaceScores[0]?.participant || winner)} />
        )}
        {activeTab === tabs.home && step === steps.tieRematch && (
          <TieRematchScreen tiedScores={firstPlaceScores} onConfirm={confirmGameWinner} />
        )}
        {activeTab === tabs.home && step === steps.roulette && (
          <RouletteScreen amount={effectiveAmount} participants={participants} settlementMode={settlementMode} spinning={rouletteSpinning} onSpin={spinRoulette} />
        )}
        {activeTab === tabs.home && step === steps.rouletteResult && (
          selectedGame.id === 'roulette'
            ? <RouletteResultScreen amount={effectiveAmount} settlementMode={settlementMode} splitAmount={splitAmount} winner={winner} onRetry={() => navigateHomeStep(steps.roulette)} onNext={() => navigateHomeStep(steps.finalResult)} />
            : <RandomResultScreen amount={effectiveAmount} game={selectedGame} settlementMode={settlementMode} splitAmount={splitAmount} winner={winner} onRetry={() => navigateHomeStep(steps.gamePlay)} onNext={() => navigateHomeStep(steps.finalResult)} />
        )}
        {activeTab === tabs.home && step === steps.finalResult && (
          <FinalResultScreen
            amount={effectiveAmount}
            participants={participants}
            settlementTitle={settlementTitle.trim()}
            splitAmount={splitAmount}
            winner={winner}
            onRestart={restartSettlement}
            onShare={() => setShareOpen(true)}
          />
        )}
        {activeTab === tabs.home && step === steps.gameFinalResult && (
          <FinalResultScreen
            amount={effectiveAmount}
            game={selectedGame}
            isGameResult
            participants={participants}
            settlementTitle={settlementTitle.trim()}
            splitAmount={splitAmount}
            winner={winner}
            onRestart={restartSettlement}
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
          settlementTitle={settlementTitle.trim() || '삼겹살 회식 정산'}
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

function TitleScreen({ title, onChangeTitle, onNext }) {
  const trimmedTitle = title.trim()

  return (
    <section className="screen title-screen" aria-labelledby="title-entry-title">
      <TdsTitle id="title-entry-title" subtitle="결과 화면과 공유 이미지에 표시될 이름이에요." title="어떤 정산인가요?" />
      <form
        className="title-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmedTitle) {
            onNext()
          }
        }}
      >
        <TextField
          aria-label="정산 타이틀"
          label="정산 타이틀"
          labelOption="sustain"
          placeholder="예: 강남역 삼겹살 모임"
          value={title}
          variant="box"
          onChange={(event) => onChangeTitle(event.target.value)}
        />
      </form>
      <div className="tip-card"><Icon>edit_note</Icon> 입력한 타이틀은 결과 화면과 공유 이미지 파일명으로 사용됩니다.</div>
      <ScreenCTA disabled={!trimmedTitle} icon="arrow_forward" onClick={onNext}>금액 입력하기</ScreenCTA>
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
      <ScreenCTA icon="chevron_right" testId="participants-next" onClick={onNext}>정산 방식 고르기</ScreenCTA>
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
            data-testid={`method-${mode.id}`}
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
      <ScreenCTA icon="arrow_forward" testId="method-next" onClick={onNext}>{selected === 'exempt' ? '게임 선택하기' : '결과 확인하기'}</ScreenCTA>
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
      <ScreenCTA icon="play_arrow" testId="exempt-next" onClick={onNext}>게임 선택하기</ScreenCTA>
    </section>
  )
}

function getSettlementModeLabel(mode) {
  return settlementModes.find((item) => item.id === mode)?.title || '한 명 면제'
}

function GameSelectScreen({ games, selectedGameId, settlementMode, onSelect, onNext }) {
  return (
    <section className="screen game-select-screen" aria-labelledby="game-select-title">
      <TdsTitle id="game-select-title" subtitle="정산 방식에 어울리는 게임을 선택해 보세요." title="게임 선택하기" />
      <div className="summary-banner compact-summary">
        <span>선택한 정산 방식</span>
        <strong>{getSettlementModeLabel(settlementMode)}</strong>
        <Icon>sports_esports</Icon>
      </div>
      <ul className="game-card-list">
        {games.map((game) => (
          <li key={game.id}>
            <button
              className={selectedGameId === game.id ? 'game-card selected-card' : 'game-card'}
              data-testid={`game-card-${game.id}`}
              type="button"
              onClick={() => onSelect(game.id)}
            >
              <span className="game-icon"><Icon>{game.icon}</Icon></span>
              <span className="game-card-copy">
                <small>{game.badge}</small>
                <strong>{game.title}</strong>
                <em>{game.description}</em>
              </span>
              <span className={selectedGameId === game.id ? 'game-check visible' : 'game-check'}><Icon>check_circle</Icon></span>
            </button>
          </li>
        ))}
      </ul>
      <ScreenCTA icon="play_arrow" testId="game-select-next" onClick={onNext}>게임 시작하기</ScreenCTA>
    </section>
  )
}

function GameRulesScreen({ game, onNext }) {
  return (
    <section className="screen game-rules-screen" aria-labelledby="game-rules-title">
      <TdsTitle id="game-rules-title" subtitle={game.description} title="게임 규칙 안내" />
      <div className="game-hero-card">
        <span className="game-icon large"><Icon>{game.icon}</Icon></span>
        <strong>{game.title}</strong>
        <p>{game.rule}</p>
      </div>
      <div className="rule-grid">
        <div><Icon>looks_one</Icon><strong>한 명씩 플레이</strong><small>참여자 순서대로 휴대폰을 넘겨요.</small></div>
        <div><Icon>workspace_premium</Icon><strong>1등 면제권</strong><small>순위형 게임은 1등이 면제권자가 돼요.</small></div>
        <div><Icon>restart_alt</Icon><strong>동점 재대결</strong><small>1등이 동점이면 재대결 화면에서 확정해요.</small></div>
      </div>
      <ScreenCTA icon="arrow_forward" testId="game-rules-next" onClick={onNext}>플레이 순서 확인</ScreenCTA>
    </section>
  )
}

function PlayOrderScreen({ participants, onNext }) {
  return (
    <section className="screen play-order-screen" aria-labelledby="play-order-title">
      <TdsTitle id="play-order-title" subtitle="아래 순서대로 한 명씩 플레이해 주세요." title="플레이 순서 확인" />
      <ol className="order-list">
        {participants.map((participant, index) => (
          <li key={participant}>
            <span>{index + 1}</span>
            <strong>{participant}</strong>
            <small>{index === 0 ? '첫 번째 플레이어' : '대기 중'}</small>
          </li>
        ))}
      </ol>
      <ScreenCTA icon="sports_esports" testId="play-order-next" onClick={onNext}>첫 번째 참여자에게 넘기기</ScreenCTA>
    </section>
  )
}

function ParticipantTurnScreen({ participant, progress, onNext }) {
  return (
    <section className="screen participant-turn-screen" aria-labelledby="turn-title">
      <TdsTitle centered id="turn-title" subtitle={`${progress} 플레이어`} title="참여자 전환" />
      <div className="turn-card">
        <span className="avatar giant">{participant.slice(0, 1)}</span>
        <strong>{participant} 차례예요</strong>
        <p>다른 사람의 기록이 보이지 않게 휴대폰을 넘긴 뒤 시작해 주세요.</p>
      </div>
      <ScreenCTA icon="play_arrow" testId="participant-turn-start" onClick={onNext}>{participant} 시작하기</ScreenCTA>
    </section>
  )
}

function RandomGameScreen({ game, participants, onComplete }) {
  if (game.id === 'fastRandom') {
    return <FastRandomGameScreen game={game} participants={participants} onComplete={onComplete} />
  }

  return <ReceiptEnvelopeGameScreen game={game} participants={participants} onComplete={onComplete} />
}

function FastRandomGameScreen({ game, participants, onComplete }) {
  const [drawing, setDrawing] = useState(false)
  const [picked, setPicked] = useState('')

  function draw() {
    setDrawing(true)
    setPicked('')
    window.setTimeout(() => {
      const nextPicked = participants[0]
      setPicked(nextPicked)
      setDrawing(false)
      onComplete(nextPicked)
    }, 2500)
  }

  return (
    <section className="screen random-game-screen fast-random-screen" aria-labelledby="fast-random-title">
      <TdsTitle centered id="fast-random-title" subtitle="이름 카드가 가운데로 모이면 결과가 공개돼요." title={game.title} />
      <div className={drawing ? 'fast-random-stage drawing' : 'fast-random-stage'} data-testid="fast-random-stage">
        <div className="fast-random-particles" aria-hidden="true">
          {participants.map((participant, index) => <span key={participant} style={{ '--particle': index }}>{participant.slice(0, 1)}</span>)}
        </div>
        <div className="fast-random-card">
          <Icon>{drawing ? 'sync' : 'bolt'}</Icon>
          <strong data-testid={picked ? 'random-result-name' : undefined}>{picked || (drawing ? '선택 중' : 'READY')}</strong>
          <small>{drawing ? '2.5초 동안 랜덤 뽑기' : '버튼을 누르면 바로 시작해요'}</small>
        </div>
      </div>
      <Button data-testid="fast-random-draw" color="primary" display="full" size="large" type="button" disabled={drawing} onClick={draw}>
        <Icon>{drawing ? 'sync' : 'casino'}</Icon> {picked ? '다시 뽑기' : '랜덤 뽑기'}
      </Button>
    </section>
  )
}

function ReceiptEnvelopeGameScreen({ game, participants, onComplete }) {
  const [selectedIndex, setSelectedIndex] = useState(null)

  function openEnvelope() {
    if (selectedIndex == null) {
      return
    }

    onComplete(participants[selectedIndex % participants.length])
  }

  return (
    <section className="screen random-game-screen receipt-envelope-screen" aria-labelledby="receipt-envelope-title">
      <TdsTitle centered id="receipt-envelope-title" subtitle="봉투 하나를 고른 뒤 열어 결과를 확인해요." title={game.title} />
      <div className="envelope-grid">
        {participants.map((participant, index) => (
          <button
            className={selectedIndex === index ? 'receipt-envelope selected-envelope' : 'receipt-envelope'}
            data-testid={`receipt-envelope-${index + 1}`}
            key={participant}
            type="button"
            onClick={() => setSelectedIndex(index)}
          >
            <Icon>{selectedIndex === index ? 'mark_email_read' : 'drafts'}</Icon>
            <span>#{index + 1}</span>
            <small>{selectedIndex === index ? '선택됨' : '영수증 봉투'}</small>
          </button>
        ))}
      </div>
      <Button data-testid="receipt-envelope-open" color="primary" display="full" size="large" type="button" disabled={selectedIndex == null} onClick={openEnvelope}>
        <Icon>inventory</Icon> 봉투 열어보기
      </Button>
    </section>
  )
}

function RankingGameScreen({ game, participant, playerIndex = 0, onComplete }) {
  const [measuredScore, setMeasuredScore] = useState(null)

  return (
    <section className={`screen ranking-game-screen ${game.id}-screen`} aria-labelledby="ranking-game-title">
      <TdsTitle centered id="ranking-game-title" subtitle={`${participant} 님의 기록을 측정해요.`} title={game.title} />
      {game.id === 'reaction' && <ReactionGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      {game.id === 'fiveSeconds' && <FiveSecondGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      {game.id === 'timingStop' && <TimingStopGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      {game.id === 'numberOrder' && <NumberOrderGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      {game.id === 'movingTarget' && <MovingTargetGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      {game.id === 'memoryCard' && <MemoryCardGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      <div className="info-card"><Icon>touch_app</Icon> 플레이가 끝나면 이번 차례 기록이 저장돼요.<small>{measuredScore ? measuredScore.displayScore : `기본 기록 ${playerIndex + 1}`}</small></div>
      <ScreenCTA icon="check" testId="complete-game-turn" onClick={() => onComplete(measuredScore)}>이번 차례 완료</ScreenCTA>
    </section>
  )
}

function ReactionGameScreen({ game, participant, onScore }) {
  const [state, setState] = useState('waiting')
  const [result, setResult] = useState('')
  const signalAtRef = useRef(0)

  function armSignal() {
    setState('waiting')
    setResult('')
    window.setTimeout(() => {
      signalAtRef.current = Date.now()
      setState('signal')
    }, 3000)
  }

  useEffect(() => {
    armSignal()
  }, [participant])

  function tap() {
    if (state === 'done') {
      return
    }

    if (state !== 'signal') {
      setState('early')
      setResult('Too early')
      return
    }

    const reactionMs = Math.max(0, Date.now() - signalAtRef.current)
    setState('done')
    setResult(`${reactionMs}ms`)
    onScore(createMeasuredGameScore({ detail: { reactionMs }, displayScore: 'reaction recorded', gameId: game.id, metric: reactionMs, participant, rawScore: reactionMs }))
  }

  return (
    <div className="game-play-stage reaction-stage">
      <button className={`reaction-pad ${state}`} data-testid="reaction-action" type="button" onClick={tap}>
        {state === 'signal' ? 'TAP' : state === 'early' ? 'Too early' : state === 'done' ? 'Done' : 'Wait'}
      </button>
      <Button data-testid="reaction-reset" color="dark" size="small" type="button" variant="weak" onClick={armSignal}>다시 준비</Button>
      {state === 'done' && <strong className="game-live-score">{result}</strong>}
    </div>
  )
}

function FiveSecondGameScreen({ game, participant, onScore }) {
  const [running, setRunning] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!running) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000)
    }, 50)

    return () => window.clearInterval(timerId)
  }, [running, startedAt])

  function start() {
    const now = Date.now()
    setStartedAt(now)
    setElapsed(0)
    setResult(null)
    setRunning(true)
  }

  function stop() {
    const nextElapsed = (Date.now() - startedAt) / 1000
    const diff = Math.abs(nextElapsed - 5)
    setElapsed(nextElapsed)
    setResult({ diff, elapsed: nextElapsed })
    setRunning(false)
    onScore(createMeasuredGameScore({ detail: { diffSeconds: diff, elapsedSeconds: nextElapsed }, displayScore: 'time recorded', gameId: game.id, metric: diff, participant, rawScore: nextElapsed }))
  }

  return (
    <div className="game-play-stage five-second-stage">
      <div className={running && elapsed >= 1 ? 'five-second-dial blurred-time' : 'five-second-dial'}>
        <strong>{elapsed.toFixed(3)}</strong>
        <span>5.000</span>
      </div>
      <div className="game-action-row">
        <Button data-testid="five-second-start" color="primary" size="large" type="button" variant="weak" disabled={running} onClick={start}>START</Button>
        <Button data-testid="five-second-stop" color="primary" size="large" type="button" disabled={!running} onClick={stop}>STOP</Button>
      </div>
      {result && <strong className="game-live-score">diff {result.diff.toFixed(3)}s</strong>}
    </div>
  )
}

function TimingStopGameScreen({ game, participant, onScore }) {
  const [position, setPosition] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) {
      return undefined
    }

    const timerId = window.setInterval(() => setPosition((current) => (current + 7) % 101), 80)
    return () => window.clearInterval(timerId)
  }, [done])

  function stop() {
    const distance = Math.abs(position - 50)
    setDone(true)
    onScore(createMeasuredGameScore({ detail: { distance, position }, displayScore: `${distance}pt`, gameId: game.id, metric: distance, participant, rawScore: distance }))
  }

  return (
    <div className="game-play-stage timing-stage">
      <div className="timing-track"><i style={{ left: `${position}%` }} /><b /></div>
      <strong className="game-live-score">target distance: {Math.abs(position - 50)}</strong>
      <Button data-testid="timing-stop" color="primary" display="full" size="large" type="button" disabled={done} onClick={stop}>멈추기</Button>
    </div>
  )
}

function NumberOrderGameScreen({ game, participant, onScore }) {
  const tiles = [3, 1, 7, 2, 9, 4, 6, 5, 8]
  const [startedAt, setStartedAt] = useState(0)
  const [nextNumber, setNextNumber] = useState(1)
  const [mistakes, setMistakes] = useState(0)
  const [done, setDone] = useState(false)

  function start() {
    setStartedAt(Date.now())
    setNextNumber(1)
    setMistakes(0)
    setDone(false)
  }

  function press(tile) {
    if (!startedAt || done) {
      return
    }

    if (tile !== nextNumber) {
      setMistakes((current) => current + 1)
      return
    }

    if (tile === 9) {
      const elapsedMs = Date.now() - startedAt
      const penaltyMistakes = mistakes
      const penaltyMs = penaltyMistakes * 500
      const metric = elapsedMs + penaltyMs
      setDone(true)
      onScore(createMeasuredGameScore({ detail: { elapsedMs, mistakes: penaltyMistakes, penaltyMs }, displayScore: `${(metric / 1000).toFixed(3)}s`, gameId: game.id, metric, participant, rawScore: metric }))
      return
    }

    setNextNumber((current) => current + 1)
  }

  return (
    <div className="game-play-stage number-order-stage">
      <Button data-testid="number-start" color="primary" size="small" type="button" variant="weak" onClick={start}>START</Button>
      <div className="number-board">
        {tiles.map((tile) => (
          <button data-testid={`number-tile-${tile}`} key={tile} type="button" disabled={done || (startedAt > 0 && tile < nextNumber)} onClick={() => press(tile)}>
            {tile}
          </button>
        ))}
      </div>
      <strong className="game-live-score">next: {nextNumber} / mistakes: {mistakes}{done ? ' / penalty applied' : ''}</strong>
    </div>
  )
}

function MovingTargetGameScreen({ game, participant, onScore }) {
  const [running, setRunning] = useState(false)
  const [hits, setHits] = useState(0)
  const [done, setDone] = useState(false)
  const hitsRef = useRef(0)

  function start() {
    setRunning(true)
    setDone(false)
    hitsRef.current = 0
    setHits(0)
    window.setTimeout(() => {
      const finalHits = hitsRef.current
      setRunning(false)
      setDone(true)
      onScore(createMeasuredGameScore({ detail: { hits: finalHits }, displayScore: `score ${finalHits}`, gameId: game.id, metric: -finalHits, participant, rawScore: finalHits }))
    }, 5000)
  }

  function hitTarget() {
    if (!running) {
      return
    }

    hitsRef.current += 1
    setHits(hitsRef.current)
  }

  return (
    <div className="game-play-stage moving-target-stage">
      <div className="target-hud">hits: {hits}</div>
      <div className="target-arena">
        {[0, 1, 2, 3, 4].map((target) => (
          <button data-testid="moving-target" key={target} type="button" disabled={!running} style={{ '--target': target }} onPointerDown={hitTarget}>
            <Icon>radio_button_checked</Icon>
          </button>
        ))}
      </div>
      <Button data-testid="target-start" color="primary" display="full" size="large" type="button" disabled={running} onClick={start}>START</Button>
      {done && <strong className="game-live-score">{hits} hits</strong>}
    </div>
  )
}

function MemoryCardGameScreen({ game, participant, onScore }) {
  const cards = ['A', 'B', 'C', 'A', 'C', 'B']
  const [memorizing, setMemorizing] = useState(true)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [selected, setSelected] = useState([])
  const [matched, setMatched] = useState([])
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setStartedAt(Date.now())
      setMemorizing(false)
    }, 3000)

    return () => window.clearTimeout(timerId)
  }, [participant])

  function flip(index) {
    if (memorizing || matched.includes(index) || selected.includes(index) || selected.length >= 2) {
      return
    }

    const nextSelected = [...selected, index]
    setSelected(nextSelected)

    if (nextSelected.length !== 2) {
      return
    }

    const [first, second] = nextSelected
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)

    if (cards[first] === cards[second]) {
      const nextMatched = [...matched, first, second]
      setMatched(nextMatched)
      setSelected([])
      if (nextMatched.length === cards.length) {
        const elapsedMs = Date.now() - startedAt
        const metric = elapsedMs + nextAttempts * 250
        onScore(createMeasuredGameScore({ detail: { attempts: nextAttempts, elapsedMs }, displayScore: `${(metric / 1000).toFixed(3)}s`, gameId: game.id, metric, participant, rawScore: metric }))
      }
      return
    }

    window.setTimeout(() => setSelected([]), 400)
  }

  return (
    <div className="game-play-stage memory-card-stage">
      <div className="memory-status">{memorizing ? 'Memorize' : `attempts: ${attempts}`}</div>
      <div className="memory-board">
        {cards.map((card, index) => {
          const visible = memorizing || selected.includes(index) || matched.includes(index)
          return (
            <button className={visible ? 'memory-card flipped' : 'memory-card'} data-testid={`memory-card-${index}`} key={`${card}-${index}`} type="button" disabled={matched.includes(index)} onClick={() => flip(index)}>
              {visible ? card : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LegacyRankingGameScreen({ game, participant, onComplete }) {
  const numberTiles = game.id === 'numberOrder' ? [1, 4, 2, 6, 3, 5] : []
  const memoryTiles = game.id === 'memoryCard' ? ['A', 'B', 'C', 'A', 'C', 'B'] : []

  return (
    <section className={`screen ranking-game-screen ${game.id}-screen`} aria-labelledby="ranking-game-title">
      <TdsTitle centered id="ranking-game-title" subtitle={`${participant} 님의 기록을 측정해요.`} title={game.title} />
      <div className="game-play-stage">
        {game.id === 'reaction' && <button className="reaction-pad" type="button">초록색이 되면 탭!</button>}
        {game.id === 'fiveSeconds' && <div className="five-second-dial"><strong>5.000</strong><span>STOP</span></div>}
        {game.id === 'timingStop' && <div className="timing-track"><i /><b /></div>}
        {game.id === 'numberOrder' && <div className="number-board">{numberTiles.map((tile) => <button key={tile} type="button">{tile}</button>)}</div>}
        {game.id === 'movingTarget' && <div className="target-arena"><button type="button" aria-label="움직이는 표적"><Icon>radio_button_checked</Icon></button></div>}
        {game.id === 'memoryCard' && <div className="memory-board">{memoryTiles.map((tile, index) => <button key={`${tile}-${index}`} type="button">{tile}</button>)}</div>}
      </div>
      <div className="info-card"><Icon>touch_app</Icon> 데모 플레이에서는 버튼을 누르면 이번 차례 기록이 저장돼요.</div>
      <ScreenCTA icon="check" onClick={onComplete}>이번 차례 완료</ScreenCTA>
    </section>
  )
}

function RankingResultScreen({ game, scores, onNext }) {
  const winnerScore = scores[0]

  return (
    <section className="screen ranking-result-screen" aria-labelledby="ranking-result-title">
      <TdsTitle centered id="ranking-result-title" subtitle={`${game.title} 결과`} title="전체 순위 결과" />
      <div className="winner-summary">
        <span className="winner-medal">1등</span>
        <strong>{winnerScore?.participant} 님 면제권 획득</strong>
        <small>{winnerScore ? getGameScoreLabel(game, winnerScore) : ''}</small>
      </div>
      <ol className="ranking-list">
        {scores.map((score) => (
          <li className={score.rank === 1 ? 'rank-row first' : 'rank-row'} key={score.participant}>
            <span>{score.rank}등</span>
            <strong>{score.participant}</strong>
            <small>{getGameScoreLabel(game, score)}</small>
          </li>
        ))}
      </ol>
      <ScreenCTA icon="receipt_long" onClick={onNext}>최종 정산 보기</ScreenCTA>
    </section>
  )
}

function TieRematchScreen({ tiedScores, onConfirm }) {
  return (
    <section className="screen tie-rematch-screen" aria-labelledby="tie-rematch-title">
      <TdsTitle centered id="tie-rematch-title" subtitle="1등이 동점이라 면제권자를 확정해야 해요." title="동점 재대결" />
      <div className="tie-card">
        <Icon>emoji_events</Icon>
        <strong>{tiedScores.map((score) => score.participant).join(', ')}</strong>
        <p>동점자끼리 다시 겨루거나, 지금 바로 면제자를 확정할 수 있어요.</p>
      </div>
      <div className="tie-actions">
        {tiedScores.map((score) => (
          <Button color="primary" display="full" key={score.participant} size="large" type="button" variant="weak" onClick={() => onConfirm(score.participant)}>
            {score.participant} 면제자로 확정
          </Button>
        ))}
      </div>
    </section>
  )
}

function RouletteScreen({ amount, participants, settlementMode, spinning, onSpin }) {
  return (
    <section className="screen roulette-screen" aria-labelledby="roulette-title">
      <TdsTitle centered id="roulette-title" subtitle={spinning ? '잠시만 기다려 주세요. 정산 대상자를 고르고 있어요.' : `${getSettlementModeLabel(settlementMode)} 대상자를 룰렛으로 정해요.`} title="오늘의 정산 결과는?" />
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

function RouletteResultScreen({ amount, settlementMode, splitAmount, winner, onRetry, onNext }) {
  const modeLabel = getSettlementModeLabel(settlementMode)
  const isExemptMode = settlementMode === 'exempt'

  return (
    <section className="screen roulette-result-screen" aria-labelledby="roulette-result-title">
      <div className="winner-illustration">
        <div className="winner-artwork" role="img" aria-label={`${winner} 님 면제 확정 이미지`}>
          <img alt="" aria-hidden="true" src={settlementCompleteImage} />
        </div>
        <div className="confetti-rain" data-testid="confetti-rain" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="roulette-result-card">
          <small>룰렛 결과 확인</small>
          <div className="mini-result-roulette" aria-hidden="true">
            <span>{winner.slice(0, 1)}</span>
          </div>
          <strong>{winner} 님 {isExemptMode ? '면제' : '선택'}</strong>
          <p>나머지 인원 각 {formatWon(splitAmount)}</p>
          <em>총 {formatWon(amount)}</em>
          <span className="result-kicker"><Icon>auto_awesome</Icon> {isExemptMode ? '면제 확정' : `${modeLabel} 적용`}</span>
        </div>
      </div>
      <TdsTitle centered id="roulette-result-title" subtitle={isExemptMode ? `나머지 세 명이 ${formatWon(splitAmount)}씩 나눠 내요.` : `룰렛 결과를 ${modeLabel} 방식에 적용해요.`} title={isExemptMode ? `${winner} 님이 면제됐어요` : `${winner} 님이 선택됐어요`} />
      <div className="result-stats">
        <div><small>결제 총액</small><strong>{formatWon(amount)}</strong><Icon>receipt_long</Icon></div>
        <div><small>{isExemptMode ? '면제자' : '선택된 사람'}</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>1인당 금액</small><strong>{formatWon(splitAmount)}</strong></div>
      </div>
      <div className="button-row">
        <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</Button>
        <Button color="primary" display="full" size="large" type="button" onClick={onNext}>금액 확인하기</Button>
      </div>
    </section>
  )
}

function RandomResultScreen({ amount, game, settlementMode, splitAmount, winner, onRetry, onNext }) {
  const modeLabel = getSettlementModeLabel(settlementMode)

  return (
    <section className="screen roulette-result-screen random-result-screen" aria-labelledby="random-result-title">
      <div className="winner-illustration">
        <div className="winner-artwork" role="img" aria-label={`${winner} 랜덤 결과 이미지`}>
          <img alt="" aria-hidden="true" src={settlementCompleteImage} />
        </div>
        <div className="confetti-rain" data-testid="confetti-rain" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
        <div className="roulette-result-card">
          <small>{game.title} 결과</small>
          <div className="mini-result-roulette" aria-hidden="true"><span>{winner.slice(0, 1)}</span></div>
          <strong data-testid="random-result-name">{winner}</strong>
          <p>{modeLabel} 적용</p>
          <em>총 {formatWon(amount)}</em>
        </div>
      </div>
      <TdsTitle centered id="random-result-title" subtitle={`${game.title} 결과를 ${modeLabel} 방식에 적용해요.`} title={`${winner} 님이 선택됐어요`} />
      <div className="result-stats">
        <div><small>결제 총액</small><strong>{formatWon(amount)}</strong><Icon>receipt_long</Icon></div>
        <div><small>선택된 사람</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>1인당 금액</small><strong>{formatWon(splitAmount)}</strong></div>
      </div>
      <div className="button-row">
        <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</Button>
        <Button data-testid="random-result-next" color="primary" display="full" size="large" type="button" onClick={onNext}>금액 확인하기</Button>
      </div>
    </section>
  )
}

function FinalResultScreen({ amount, game, isGameResult = false, participants, settlementTitle, splitAmount, winner, onRestart, onShare }) {
  return (
    <section className="screen final-screen" aria-labelledby="final-title">
      <div className="success-icon"><Icon>check_circle</Icon></div>
      <TdsTitle centered id="final-title" subtitle="총 정산 금액" title={isGameResult ? '게임 정산이 완료됐어요' : '정산이 완료됐어요'} />
      <strong className="settlement-title">{settlementTitle}</strong>
      <strong className="big-amount">{formatWon(amount)}</strong>
      <span className="mode-badge"><Icon>{isGameResult ? 'sports_esports' : 'casino'}</Icon> {isGameResult ? `${game?.title || '게임'} 1등 면제권 적용` : '한 명 면제 방식 적용'}</span>
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

function ShareSheet({ amount, open, participants, settlementTitle, splitAmount, winner, onClose }) {
  const { openToast } = useWebToast({ exitOnUnmount: false })
  const [shareActionPending, setShareActionPending] = useState(null)
  const payload = buildSharePayload({ amount, participants, settlementTitle, splitAmount, winner })

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
          <strong>{payload.title}</strong>
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

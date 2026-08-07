import { useEffect, useMemo, useRef, useState } from 'react'
import { getTossShareLink, loadFullScreenAd, saveBase64Data, setClipboardText, share, showFullScreenAd, Storage, TossAds } from '@apps-in-toss/web-framework'
import { useCallback } from 'react'
import { useReducer } from 'react'
import { BottomCTA, BottomSheet, Button, ConfirmDialog, IconButton, ListHeader, ListRow, SegmentedControl, Switch, Tab, TextField, Top, useWebToast } from '@toss/tds-mobile'
import settlementCompleteImage from './assets/settlement-complete.jpg'
import { getNextAdFrequencyState, shouldShowInterstitial } from './ads/ad-policy'
import { attachHistoryBanner, createInterstitialAd } from './ads/apps-in-toss-ads'
import { initializeAnalyticsClient } from './analytics/client'
import { getAmountBucket } from './analytics/events'
import { getGameById, getGamesForParticipants } from './games/catalog'
import { pickOne, shuffle } from './games/core/random'
import { createGameScore, formatGameScore, getSettlementTargetScores as selectSettlementTargetScores, rankScores } from './games/core/scoring'
import { createInitialGameSession, gameSessionReducer } from './games/core/session'
import { buildSettlementPreview as buildSettlementPreviewCore, calculateSettlementResult as calculateSettlementResultCore, formatWon, settlementModes } from './games/core/settlement'
import { createEnvelopeAssignments, createRouletteGradient, getRouletteRotation } from './games/random/mechanics'
import { blobToBase64, createSettlementImageBlob, deliverSettlementImage } from './results/share'
import { buildSettlementDeepLink } from './results/share-link'
import { createSettlementRepository, deriveRecentGroups } from './storage/settlement-storage'
import {
  calculateFiveSecondResult,
  calculateTimingResult,
  createBalancedNumberLayout,
  createMemoryDeck,
  getReactionDelayMs,
  getReactionFeedback,
  getTimingStartDirection,
  getTimingStopPosition as calculateTimingStopPosition,
} from './games/ranking/mechanics'

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

const earlyReactionRankMetric = Number.MAX_SAFE_INTEGER
const maxParticipants = 8

const amountKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']
const adsEnabled = import.meta.env.VITE_ENABLE_ADS === 'true'
const bannerAdGroupId = import.meta.env.VITE_AIT_BANNER_AD_GROUP_ID
const interstitialAdGroupId = import.meta.env.VITE_AIT_INTERSTITIAL_AD_GROUP_ID
const amplitudeApiKey = import.meta.env.VITE_AMPLITUDE_API_KEY

export function sanitizeFileName(title) {
  const cleanedTitle = String(title || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')

  return cleanedTitle ? `${cleanedTitle}.png` : 'nuganellae-settlement-result.png'
}

function buildSharePayload({ amount, gameId, participants, settlementMode, settlementResult, settlementTitle }) {
  const title = settlementTitle.trim()
  const result = settlementResult || calculateSettlementResultCore({ amount, participants, settlementMode: 'exempt', selectedParticipant: participants[0] })
  const memberLines = result.lineItems.map((item) => `${item.participant}: ${item.amountText}`)

  return {
    amount,
    fileName: sanitizeFileName(title),
    gameId,
    lineItems: result.lineItems,
    memberLines,
    mode: settlementMode,
    modeLabel: result.modeLabel,
    participants,
    selectedParticipant: result.selectedParticipant,
    title,
    message: [
      title,
      `총 정산 금액: ${formatWon(amount)}`,
      `정산 방식: ${result.modeLabel}`,
      result.summaryText,
      memberLines.join(' / '),
    ].join('\n'),
  }
}

async function getSettlementShareLink(payload) {
  return getTossShareLink(buildSettlementDeepLink({
    gameId: payload.gameId,
    mode: payload.mode,
    source: 'share',
  }))
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

async function saveSettlementImage(payload) {
  const blob = await createSettlementImageBlob(payload)

  return deliverSettlementImage({
    blob,
    fileName: payload.fileName,
    message: payload.message,
    nativeClipboard: (message) => setClipboardText(message),
    nativeSave: async (imageBlob) => {
      await saveBase64Data({
        data: await blobToBase64(imageBlob),
        fileName: payload.fileName,
        mimeType: 'image/png',
      })
    },
    nativeTextShare: (message) => share({ message }),
  })
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
  return formatGameScore(score)
}

function createMeasuredGameScore({ detail = {}, displayScore, gameId, metric, participant, rawScore }) {
  let displayValue = String(Math.round(Number(displayScore)))
  let unit = 'ms'

  if (gameId === 'fiveSeconds') {
    displayValue = Number(rawScore).toFixed(3)
    unit = '초'
  } else if (gameId === 'timingStop') {
    displayValue = Number(displayScore).toFixed(1)
    unit = '점'
  } else if (gameId === 'numberOrder' || gameId === 'memoryCard') {
    displayValue = (Number(rawScore) / 1000).toFixed(3)
    unit = '초'
  }

  return createGameScore({
    detail,
    displayValue,
    gameId,
    participant,
    rankMetric: metric,
    rawValue: rawScore,
    unit,
  })
}

export function getTimingStopPosition(elapsedMs, cycleMs = 1600) {
  return calculateTimingStopPosition(elapsedMs, cycleMs)
}

function getRankedScores(scores) {
  return rankScores(scores)
}

function getSettlementTargetScores(scores, settlementMode) {
  return selectSettlementTargetScores(scores, settlementMode)
}

function App() {
  const settlementRepository = useMemo(() => createSettlementRepository(Storage), [])
  const interstitialAd = useMemo(() => createInterstitialAd({
    enabled: adsEnabled,
    groupId: interstitialAdGroupId,
    load: loadFullScreenAd,
    show: showFullScreenAd,
  }), [])
  const [activeTab, setActiveTab] = useState(tabs.home)
  const [step, setStep] = useState(steps.start)
  const [settlementTitle, setSettlementTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [participants, setParticipants] = useState(baseParticipants)
  const [newParticipant, setNewParticipant] = useState('')
  const [participantMessage, setParticipantMessage] = useState('')
  const [settlementMode, setSettlementMode] = useState('exempt')
  const [winner, setWinner] = useState(baseParticipants[baseParticipants.length - 1])
  const [shareOpen, setShareOpen] = useState(false)
  const [stepHistory, setStepHistory] = useState([])
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [rouletteDuration, setRouletteDuration] = useState(2000)
  const [rouletteRotation, setRouletteRotation] = useState(0)
  const [randomError, setRandomError] = useState('')
  const [selectedGameId, setSelectedGameId] = useState('roulette')
  const [gameSession, dispatchGameSession] = useReducer(gameSessionReducer, undefined, createInitialGameSession)
  const [allowReselect, setAllowReselect] = useState(false)
  const [leaveGameDialogOpen, setLeaveGameDialogOpen] = useState(false)
  const [discardResultDialogOpen, setDiscardResultDialogOpen] = useState(false)
  const [restartTargetStep, setRestartTargetStep] = useState(null)
  const [savedSettlements, setSavedSettlements] = useState([])
  const [savedDraft, setSavedDraft] = useState(null)
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [hydrationRequest, setHydrationRequest] = useState(0)
  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const [adFrequency, setAdFrequency] = useState({
    completedCount: 0,
    lastInterstitialAt: null,
  })
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false)
  const adFrequencyRef = useRef(adFrequency)
  const settlementsReadableRef = useRef(false)
  const pendingSettlementsRef = useRef([])
  const analyticsRef = useRef({
    initialize: () => false,
    setEnabled: () => {},
    track: () => false,
  })
  const anonymousIdRef = useRef(null)
  const analyticsOptOutRef = useRef(false)
  const analyticsInitializedRef = useRef(false)
  const analyticsLoadingRef = useRef(false)
  const recordedCompletionRef = useRef(null)

  const paidParticipants = useMemo(
    () => participants.filter((participant) => participant !== winner),
    [participants, winner],
  )
  const effectiveAmount = amount || 84000
  const splitAmount = Math.ceil(effectiveAmount / Math.max(1, paidParticipants.length))
  const settlementResult = useMemo(
    () => calculateSettlementResultCore({
      amount: effectiveAmount,
      participants,
      selectedParticipant: winner,
      settlementMode,
    }),
    [effectiveAmount, participants, settlementMode, winner],
  )
  const selectedGame = getGameById(selectedGameId)
  const recentGroups = useMemo(() => deriveRecentGroups(savedSettlements), [savedSettlements])
  const currentPlayerIndex = gameSession.currentPlayerIndex
  const gameScores = gameSession.scores
  const rematchScores = gameSession.scores
  const isRematchRound = gameSession.isRematchRound
  const rankedScores = useMemo(() => getRankedScores(gameScores, selectedGame), [gameScores, selectedGame])
  const rematchRankedScores = useMemo(() => getRankedScores(rematchScores, selectedGame), [rematchScores, selectedGame])
  const settlementTargetScores = getSettlementTargetScores(isRematchRound ? rematchRankedScores : rankedScores, settlementMode)
  const activeGameParticipants = gameSession.playerOrder.length > 0 ? gameSession.playerOrder : participants
  const activeGameScores = gameSession.scores
  const isFinalStep = step === steps.finalResult || step === steps.gameFinalResult
  const isResultStep = step === steps.rouletteResult || step === steps.rankingResult || step === steps.tieRematch
  const isGameInProgressStep = step === steps.participantTurn || step === steps.gamePlay || step === steps.roulette
  const showHomeTopBar = activeTab === tabs.home && step !== steps.detail && !isFinalStep && !(isResultStep && !allowReselect)

  const reportStorageError = useCallback((message = '기기 저장소에 변경 내용을 저장하지 못했어요') => {
    setStorageError(message)
  }, [])

  const initializeAnalytics = useCallback(async (anonymousId = anonymousIdRef.current) => {
    if (!amplitudeApiKey || !anonymousId) {
      return false
    }

    if (analyticsInitializedRef.current) {
      analyticsRef.current.setEnabled(true)
      return true
    }

    if (analyticsLoadingRef.current) {
      return false
    }

    analyticsLoadingRef.current = true
    try {
      const client = await initializeAnalyticsClient({
        apiKey: amplitudeApiKey,
        deviceId: anonymousId,
        isOptedOut: () => analyticsOptOutRef.current,
        loadSdk: () => import('@amplitude/analytics-browser'),
      })
      if (!client) {
        return false
      }

      analyticsRef.current = client
      analyticsInitializedRef.current = true
      return true
    } catch {
      return false
    } finally {
      analyticsLoadingRef.current = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function hydrateStorage() {
      setStorageHydrated(false)
      setStorageError('')
      try {
        const results = await Promise.allSettled([
          settlementRepository.loadDraft(),
          settlementRepository.loadSettlements(),
          settlementRepository.loadAdFrequency(),
          settlementRepository.loadAnalyticsOptOut(),
          settlementRepository.getAnonymousId(),
        ])
        if (!active) {
          return
        }

        const valueAt = (index, fallback) => (
          results[index].status === 'fulfilled' ? results[index].value : fallback
        )
        const draft = valueAt(0, null)
        const records = valueAt(1, [])
        const storedAdFrequency = valueAt(2, {
          completedCount: 0,
          lastInterstitialAt: null,
        })
        const storedAnalyticsOptOut = valueAt(3, true)
        const storedAnonymousId = valueAt(4, null)
        const settlementsReadSucceeded = results[1].status === 'fulfilled'
        const anonymousId =
          storedAnonymousId ||
          globalThis.crypto?.randomUUID?.() ||
          `anonymous-${Date.now()}`

        anonymousIdRef.current = anonymousId
        setSavedDraft(draft)
        setAdFrequency(storedAdFrequency)
        adFrequencyRef.current = storedAdFrequency
        setAnalyticsOptOut(Boolean(storedAnalyticsOptOut))
        analyticsOptOutRef.current = Boolean(storedAnalyticsOptOut)
        settlementsReadableRef.current = settlementsReadSucceeded
        if (settlementsReadSucceeded) {
          const pendingRecords = pendingSettlementsRef.current
          const mergedRecords = [...pendingRecords, ...records].filter(
            (record, index, allRecords) =>
              allRecords.findIndex((candidate) => candidate.id === record.id) === index,
          )
          setSavedSettlements(mergedRecords)
          if (pendingRecords.length > 0) {
            try {
              await settlementRepository.saveSettlements(mergedRecords)
              pendingSettlementsRef.current = []
            } catch {
              reportStorageError()
            }
          }
        }

        if (results.some((result) => result.status === 'rejected')) {
          reportStorageError('저장된 정산 내역을 불러오지 못했어요')
        }

        if (!storedAnonymousId) {
          settlementRepository
            .saveAnonymousId(anonymousId)
            .catch(() => reportStorageError())
        }
        if (!storedAnalyticsOptOut) {
          void initializeAnalytics(anonymousId)
        }
      } finally {
        if (active) {
          setStorageHydrated(true)
        }
      }
    }

    void hydrateStorage()

    return () => {
      active = false
    }
  }, [
    hydrationRequest,
    initializeAnalytics,
    reportStorageError,
    settlementRepository,
  ])

  useEffect(() => {
    if (!storageHydrated || activeTab !== tabs.home || step === steps.start || step === steps.detail || isFinalStep) {
      return
    }

    const resumableStep = [
      steps.title,
      steps.amount,
      steps.participants,
      steps.method,
      steps.exempt,
      steps.gameSelect,
    ].includes(step) ? step : steps.gameSelect
    const draft = {
      version: 1,
      step: resumableStep,
      settlementTitle,
      amount,
      participants,
      settlementMode,
      selectedGameId,
      updatedAt: new Date().toISOString(),
    }

    setSavedDraft(draft)
    void settlementRepository.saveDraft(draft).catch(() => reportStorageError())
  }, [
    activeTab,
    amount,
    isFinalStep,
    participants,
    selectedGameId,
    settlementMode,
    settlementRepository,
    settlementTitle,
    step,
    storageHydrated,
    reportStorageError,
  ])

  useEffect(() => {
    if (!storageHydrated || !isFinalStep || recordedCompletionRef.current) {
      return
    }

    const completedAt = new Date().toISOString()
    const id = globalThis.crypto?.randomUUID?.() || `settlement-${Date.now()}`
    const record = {
      id,
      title: settlementTitle.trim() || '오늘 정산',
      amount: effectiveAmount,
      participants: [...participants],
      mode: settlementMode,
      modeLabel: settlementResult.modeLabel,
      gameId: step === steps.gameFinalResult ? selectedGameId : null,
      selectedParticipant: settlementResult.selectedParticipant,
      lineItems: settlementResult.lineItems,
      summaryText: settlementResult.summaryText,
      completedAt,
    }

    recordedCompletionRef.current = id
    setSavedDraft(null)
    const nextSettlements = [record, ...savedSettlements]
    setSavedSettlements(nextSettlements)
    if (settlementsReadableRef.current) {
      void settlementRepository
        .saveSettlements(nextSettlements)
        .then(() => {
          pendingSettlementsRef.current = []
        })
        .catch(() => {
          pendingSettlementsRef.current = [
            record,
            ...pendingSettlementsRef.current.filter(
              (pendingRecord) => pendingRecord.id !== record.id,
            ),
          ]
          reportStorageError()
        })
    } else {
      pendingSettlementsRef.current = [
        record,
        ...pendingSettlementsRef.current.filter(
          (pendingRecord) => pendingRecord.id !== record.id,
        ),
      ]
      reportStorageError('기존 정산 내역을 불러온 뒤 새 기록을 저장할 수 있어요')
    }
    const nextAdFrequency = getNextAdFrequencyState(adFrequencyRef.current, {
      type: 'SETTLEMENT_COMPLETED',
    })
    adFrequencyRef.current = nextAdFrequency
    setAdFrequency(nextAdFrequency)
    void settlementRepository
      .saveAdFrequency(nextAdFrequency)
      .catch(() => reportStorageError())
    if (shouldShowInterstitial(nextAdFrequency)) {
      void interstitialAd.preload()
    }
    analyticsRef.current.track('settlement_completed', {
      amount_bucket: getAmountBucket(effectiveAmount),
      game_id: record.gameId || undefined,
      mode: settlementMode,
      participant_count: participants.length,
      stage: 'result',
    })
    void settlementRepository.removeDraft().catch(() => reportStorageError())
  }, [
    effectiveAmount,
    isFinalStep,
    participants,
    selectedGameId,
    settlementMode,
    interstitialAd,
    settlementRepository,
    settlementResult,
    settlementTitle,
    savedSettlements,
    step,
    storageHydrated,
    reportStorageError,
  ])

  useEffect(() => {
    if (!rouletteSpinning) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setRouletteSpinning(false)
      navigateHomeStep(steps.rouletteResult)
    }, rouletteDuration)

    return () => window.clearTimeout(timerId)
  }, [rouletteDuration, rouletteSpinning])

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
    if (isGameInProgressStep) {
      setLeaveGameDialogOpen(true)
      return
    }

    const previousStep = stepHistory[stepHistory.length - 1] || steps.start

    setActiveTab(tabs.home)
    setShareOpen(false)
    setRouletteSpinning(false)
    setStepHistory((history) => history.slice(0, -1))
    setStep(previousStep)
  }

  function closeLeaveGameDialog() {
    setLeaveGameDialogOpen(false)
  }

  function confirmLeaveGame() {
    setLeaveGameDialogOpen(false)
    resetGameProgress()
    navigateHomeStep(steps.gameSelect, { resetHistory: true })
  }

  function requestResultRestart(targetStep) {
    setRestartTargetStep(targetStep)
    setDiscardResultDialogOpen(true)
  }

  function closeDiscardResultDialog() {
    setDiscardResultDialogOpen(false)
    setRestartTargetStep(null)
  }

  function confirmDiscardResult() {
    const targetStep = restartTargetStep

    setDiscardResultDialogOpen(false)
    setRestartTargetStep(null)
    setWinner(participants[participants.length - 1] || '')
    setRouletteSpinning(false)
    setRouletteDuration(2000)
    setRouletteRotation(0)
    setRandomError('')

    if (selectedGame.category === 'ranking') {
      dispatchGameSession({
        type: 'DISCARD_AND_RESTART',
        payload: { playerOrder: shuffle(participants) },
      })
    } else {
      resetGameProgress()
    }

    if (targetStep) {
      navigateHomeStep(targetStep, { resetHistory: true })
    }
  }

  function handleParticipantSubmit(event) {
    event.preventDefault()
    const name = newParticipant.trim()

    if (!name || participants.includes(name)) {
      setNewParticipant('')
      return
    }

    if (participants.length >= maxParticipants) {
      setParticipantMessage(`최대 ${maxParticipants}명까지 참여할 수 있어요.`)
      setNewParticipant('')
      return
    }

    setParticipants([...participants, name])
    setParticipantMessage('')
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
    if (mode === 'equal') {
      navigateHomeStep(steps.finalResult, { resetHistory: true })
      return
    }

    if (mode === 'exempt') {
      navigateHomeStep(steps.exempt)
      return
    }

    navigateHomeStep(steps.gameSelect)
  }

  function spinRoulette(mode = 'wheel') {
    try {
      const selectedParticipant = pickOne(participants)
      const selectedIndex = participants.indexOf(selectedParticipant)
      const duration = mode === 'quick' ? 350 : 2000

      setWinner(selectedParticipant)
      setRouletteDuration(duration)
      setRouletteRotation((current) => (
        Math.ceil(current / 360) * 360
        + getRouletteRotation({
          participantCount: participants.length,
          selectedIndex,
          turns: mode === 'quick' ? 1 : 4,
        })
      ))
      setRandomError('')
      setRouletteSpinning(true)
    } catch {
      setRandomError('안전한 무작위 선택을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  function resetGameProgress() {
    dispatchGameSession({ type: 'EXIT_SESSION' })
  }

  function resetSettlementDraft() {
    recordedCompletionRef.current = null
    setSettlementTitle('')
    setAmount(0)
    setNewParticipant('')
    setParticipantMessage('')
    setParticipants([...baseParticipants])
    setSettlementMode('exempt')
    setWinner(baseParticipants[baseParticipants.length - 1])
    setAllowReselect(false)
    setSelectedGameId('roulette')
    setRouletteSpinning(false)
    setRouletteDuration(2000)
    setRouletteRotation(0)
    setRandomError('')
    setShareOpen(false)
    resetGameProgress()
  }

  async function restartSettlement() {
    if (shouldShowInterstitial(adFrequencyRef.current)) {
      const result = await interstitialAd.show()
      if (result === 'dismissed') {
        const nextAdFrequency = getNextAdFrequencyState(adFrequencyRef.current, {
          type: 'INTERSTITIAL_SHOWN',
          now: new Date().toISOString(),
        })
        adFrequencyRef.current = nextAdFrequency
        setAdFrequency(nextAdFrequency)
        void settlementRepository
          .saveAdFrequency(nextAdFrequency)
          .catch(() => reportStorageError())
      }
    }

    resetSettlementDraft()
    setSavedDraft(null)
    void settlementRepository.removeDraft().catch(() => reportStorageError())
    navigateHomeStep(steps.title, { resetHistory: true })
  }

  function resumeSettlement() {
    if (!savedDraft) {
      navigateHomeStep(steps.title)
      return
    }

    setSettlementTitle(savedDraft.settlementTitle || '')
    setAmount(Number(savedDraft.amount || 0))
    setParticipants(Array.isArray(savedDraft.participants) && savedDraft.participants.length >= 2
      ? savedDraft.participants
      : [...baseParticipants])
    setSettlementMode(savedDraft.settlementMode || 'exempt')
    setSelectedGameId(savedDraft.selectedGameId || 'roulette')
    analyticsRef.current.track('settlement_resumed', { source: 'draft', stage: savedDraft.step || 'setup' })
    navigateHomeStep(savedDraft.step || steps.title, { resetHistory: true })
  }

  function startNewSettlement() {
    resetSettlementDraft()
    setSavedDraft(null)
    void settlementRepository.removeDraft().catch(() => reportStorageError())
    analyticsRef.current.track('settlement_started', { source: 'home', stage: 'setup' })
    navigateHomeStep(steps.title, { resetHistory: true })
  }

  function reuseRecentGroup(group) {
    resetSettlementDraft()
    setParticipants(group.participants)
    setWinner(group.participants[group.participants.length - 1] || '')
    analyticsRef.current.track('settlement_started', { source: 'recent_group', stage: 'setup' })
    navigateHomeStep(steps.title, { resetHistory: true })
  }

  function updateAnalyticsOptOut(nextValue) {
    const optOut = Boolean(nextValue)
    setAnalyticsOptOut(optOut)
    analyticsOptOutRef.current = optOut
    analyticsRef.current.setEnabled(!optOut)
    if (!optOut) {
      void initializeAnalytics()
    }
    void settlementRepository
      .saveAnalyticsOptOut(optOut)
      .catch(() => reportStorageError())
  }

  async function clearAllAppData() {
    try {
      await settlementRepository.clearAppData()
      resetSettlementDraft()
      setSavedDraft(null)
      setSavedSettlements([])
      settlementsReadableRef.current = true
      pendingSettlementsRef.current = []
      setSelectedSettlement(null)
      setAnalyticsOptOut(false)
      analyticsOptOutRef.current = false
      setStorageError('')
      const resetAdFrequency = {
        completedCount: 0,
        lastInterstitialAt: null,
      }
      adFrequencyRef.current = resetAdFrequency
      setAdFrequency(resetAdFrequency)
      setActiveTab(tabs.home)
      setStep(steps.start)
    } catch {
      reportStorageError('앱 데이터를 삭제하지 못했어요. 다시 시도해 주세요')
    }
  }

  function openSettlementDetail(record) {
    setSelectedSettlement(record)
    setActiveTab(tabs.home)
    setStep(steps.detail)
    setStepHistory([])
  }

  function closeSettlementDetail() {
    setShareOpen(false)
    setSelectedSettlement(null)
    setStep(steps.start)
    setActiveTab(tabs.history)
  }

  async function deleteSelectedSettlement() {
    if (!selectedSettlement) {
      return
    }

    const previousSettlements = savedSettlements
    const nextSettlements = previousSettlements.filter(
      (record) => record.id !== selectedSettlement.id,
    )
    if (!settlementsReadableRef.current) {
      const isPendingSettlement = pendingSettlementsRef.current.some(
        (record) => record.id === selectedSettlement.id,
      )
      if (!isPendingSettlement) {
        reportStorageError('정산 내역을 다시 불러온 후 삭제해 주세요')
        return
      }

      pendingSettlementsRef.current = pendingSettlementsRef.current.filter(
        (record) => record.id !== selectedSettlement.id,
      )
      setSavedSettlements(nextSettlements)
      closeSettlementDetail()
      return
    }

    setSavedSettlements(nextSettlements)
    try {
      await settlementRepository.saveSettlements(nextSettlements)
      pendingSettlementsRef.current = []
      setStorageError('')
      closeSettlementDetail()
    } catch {
      setSavedSettlements(previousSettlements)
      reportStorageError('정산 내역을 삭제하지 못했어요. 다시 시도해 주세요')
    }
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

    dispatchGameSession({
      type: 'START_SESSION',
      payload: {
        gameId: selectedGame.id,
        playerOrder: shuffle(participants),
      },
    })
    navigateHomeStep(steps.gameRules)
  }

  function startParticipantTurn() {
    dispatchGameSession({ type: 'ABORT_ACTIVE_TURN', payload: { reason: null } })
    navigateHomeStep(steps.gamePlay)
  }

  function abortActiveGameTurn(reason) {
    dispatchGameSession({ type: 'ABORT_ACTIVE_TURN', payload: { reason } })
    navigateHomeStep(steps.participantTurn, { replace: true })
  }

  function startTieRematch() {
    const nextRematchParticipants = settlementTargetScores.map((score) => score.participant)
    dispatchGameSession({
      type: 'START_TARGET_REMATCH',
      payload: { participants: shuffle(nextRematchParticipants) },
    })
    navigateHomeStep(steps.participantTurn)
  }

  function completeRandomGame(selectedParticipant) {
    setWinner(selectedParticipant)
    navigateHomeStep(steps.rouletteResult)
  }

  function completeGameTurn(measuredScore) {
    if (!measuredScore) {
      return
    }

    const participant = activeGameParticipants[currentPlayerIndex]
    const nextScores = [
      ...activeGameScores,
      measuredScore,
    ]

    dispatchGameSession({
      type: 'COMPLETE_TURN',
      payload: { participant, score: measuredScore },
    })

    if (currentPlayerIndex < activeGameParticipants.length - 1) {
      navigateHomeStep(steps.participantTurn)
      return
    }

    const ranked = getRankedScores(nextScores, selectedGame)
    const targetScores = getSettlementTargetScores(ranked, settlementMode)
    if (targetScores.length > 1) {
      navigateHomeStep(steps.tieRematch)
      return
    }

    setWinner(targetScores[0].participant)
    if (isRematchRound) {
      dispatchGameSession({ type: 'CONFIRM_RESULT' })
      navigateHomeStep(steps.gameFinalResult, { resetHistory: true })
      return
    }

    dispatchGameSession({ type: 'CONFIRM_RESULT' })
    navigateHomeStep(steps.rankingResult)
  }

  function confirmGameWinner(participant) {
    setWinner(participant)
    dispatchGameSession({ type: 'CONFIRM_RESULT' })
    navigateHomeStep(steps.gameFinalResult, { resetHistory: true })
  }

  return (
    <main className="app">
      <section className="phone-shell" aria-label="누가낼래 앱">
        {showHomeTopBar && (
          <TopBar
            title="누가낼래"
            progress={[steps.start, steps.title, steps.amount, steps.participants].includes(step) ? '1/3' : [steps.method, steps.exempt, steps.gameSelect].includes(step) ? '2/3' : '3/3'}
            onBack={goPreviousHomeStep}
          />
        )}

        {storageError && (
          <aside className="storage-error-notice" role="alert">
            <span>{storageError}</span>
            {activeTab === tabs.history && (
              <Button
                color="primary"
                size="small"
                type="button"
                variant="weak"
                onClick={() => setHydrationRequest((request) => request + 1)}
              >
                다시 불러오기
              </Button>
            )}
          </aside>
        )}

        {activeTab === tabs.history && (
          <HistoryScreen
            items={savedSettlements}
            loading={!storageHydrated}
            onOpenDetail={openSettlementDetail}
          />
        )}

        {activeTab === tabs.settings && (
          <SettingsScreen
            analyticsOptOut={analyticsOptOut}
            onAnalyticsOptOutChange={updateAnalyticsOptOut}
            onClearAll={clearAllAppData}
          />
        )}

        {activeTab === tabs.home && step === steps.start && (
          <StartScreen
            draft={savedDraft}
            recentGroups={recentGroups}
            recentSettlement={savedSettlements[0] || null}
            onOpenRecent={openSettlementDetail}
            onResume={resumeSettlement}
            onReuseGroup={reuseRecentGroup}
            onStart={startNewSettlement}
          />
        )}
        {activeTab === tabs.home && step === steps.title && (
          <TitleScreen
            title={settlementTitle}
            onChangeTitle={setSettlementTitle}
            onNext={() => navigateHomeStep(steps.amount)}
          />
        )}
        {activeTab === tabs.home && step === steps.amount && (
          <AmountScreen amount={amount} onAddAmount={addAmount} onInputKey={inputAmountKey} onReset={() => setAmount(0)} onNext={() => navigateHomeStep(steps.participants)} />
        )}
        {activeTab === tabs.home && step === steps.participants && (
          <ParticipantsScreen
            newParticipant={newParticipant}
            participantMessage={participantMessage}
            participants={participants}
            onChangeName={(name) => {
              setNewParticipant(name)
              setParticipantMessage('')
            }}
            onRemove={removeParticipant}
            onSubmit={handleParticipantSubmit}
            onNext={() => navigateHomeStep(steps.method)}
          />
        )}
        {activeTab === tabs.home && step === steps.method && (
          <MethodScreen selected={settlementMode} onSelect={setSettlementMode} onNext={() => chooseMethod(settlementMode)} />
        )}
        {activeTab === tabs.home && step === steps.exempt && (
          <ExemptScreen
            allowReselect={allowReselect}
            amount={effectiveAmount}
            people={participants.length}
            splitAmount={splitAmount}
            onAllowReselectChange={setAllowReselect}
            onNext={() => navigateHomeStep(steps.gameSelect)}
          />
        )}
        {activeTab === tabs.home && step === steps.gameSelect && (
          <GameSelectScreen
            amount={effectiveAmount}
            games={getGamesForParticipants(participants.length)}
            participants={participants}
            selectedGameId={selectedGameId}
            settlementMode={settlementMode}
            onSelect={setSelectedGameId}
            onNext={startSelectedGame}
          />
        )}
        {activeTab === tabs.home && step === steps.gameRules && (
          <GameRulesScreen amount={effectiveAmount} game={selectedGame} participants={activeGameParticipants} settlementMode={settlementMode} winner={winner} onNext={() => navigateHomeStep(steps.playOrder)} />
        )}
        {activeTab === tabs.home && step === steps.playOrder && (
          <PlayOrderScreen participants={activeGameParticipants} onNext={() => navigateHomeStep(steps.participantTurn)} />
        )}
        {activeTab === tabs.home && step === steps.participantTurn && (
          <ParticipantTurnScreen abortReason={gameSession.abortReason} participant={activeGameParticipants[currentPlayerIndex]} progress={`${currentPlayerIndex + 1}/${activeGameParticipants.length}`} onNext={startParticipantTurn} />
        )}
        {activeTab === tabs.home && step === steps.gamePlay && (
          selectedGame.category === 'random'
            ? <RandomGameScreen game={selectedGame} participants={participants} onComplete={completeRandomGame} />
            : <RankingGameScreen game={selectedGame} participant={activeGameParticipants[currentPlayerIndex]} playerIndex={currentPlayerIndex} previousScores={activeGameScores} onAbort={abortActiveGameTurn} onComplete={completeGameTurn} />
        )}
        {activeTab === tabs.home && step === steps.rankingResult && (
          <RankingResultScreen game={selectedGame} scores={rankedScores} settlementMode={settlementMode} onNext={() => confirmGameWinner(settlementTargetScores[0]?.participant || winner)} />
        )}
        {activeTab === tabs.home && step === steps.tieRematch && (
          <TieRematchScreen game={selectedGame} settlementMode={settlementMode} tiedScores={settlementTargetScores} onStartRematch={startTieRematch} />
        )}
        {activeTab === tabs.home && step === steps.roulette && (
          <RouletteScreen amount={effectiveAmount} duration={rouletteDuration} error={randomError} participants={participants} rotation={rouletteRotation} settlementMode={settlementMode} spinning={rouletteSpinning} onSpin={spinRoulette} />
        )}
        {activeTab === tabs.home && step === steps.rouletteResult && (
          selectedGame.id === 'roulette'
            ? <RouletteResultScreen amount={effectiveAmount} canRetry={allowReselect} settlementMode={settlementMode} settlementResult={settlementResult} winner={winner} onRetry={() => requestResultRestart(steps.roulette)} onNext={() => navigateHomeStep(steps.finalResult, { resetHistory: true })} />
            : <RandomResultScreen amount={effectiveAmount} canRetry={allowReselect} game={selectedGame} settlementMode={settlementMode} settlementResult={settlementResult} winner={winner} onRetry={() => requestResultRestart(steps.gamePlay)} onNext={() => navigateHomeStep(steps.finalResult, { resetHistory: true })} />
        )}
        {activeTab === tabs.home && step === steps.finalResult && (
          <FinalResultScreen
            amount={effectiveAmount}
            participants={participants}
            settlementResult={settlementResult}
            settlementTitle={settlementTitle.trim() || '오늘 정산'}
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
            settlementResult={settlementResult}
            settlementTitle={settlementTitle.trim() || '오늘 정산'}
            onRestart={restartSettlement}
            onShare={() => setShareOpen(true)}
          />
        )}
        {activeTab === tabs.home && step === steps.detail && selectedSettlement && (
          <DetailScreen
            record={selectedSettlement}
            onBack={closeSettlementDetail}
            onDelete={deleteSelectedSettlement}
            onShare={() => setShareOpen(true)}
          />
        )}

        <BottomNav activeTab={activeTab} onNavigate={(tab) => {
          setActiveTab(tab)
          setShareOpen(false)
          setRouletteSpinning(false)
          setStepHistory([])
        }} />

        <ShareSheet
          amount={selectedSettlement && step === steps.detail ? selectedSettlement.amount : effectiveAmount}
          gameId={selectedSettlement && step === steps.detail ? selectedSettlement.gameId : selectedGameId}
          open={shareOpen}
          participants={selectedSettlement && step === steps.detail ? selectedSettlement.participants : participants}
          settlementMode={selectedSettlement && step === steps.detail ? selectedSettlement.mode : settlementMode}
          settlementResult={selectedSettlement && step === steps.detail ? selectedSettlement : settlementResult}
          settlementTitle={selectedSettlement && step === steps.detail ? selectedSettlement.title : settlementTitle.trim() || '회식 정산'}
          onClose={() => setShareOpen(false)}
          onTrack={(eventName, properties) => analyticsRef.current.track(eventName, properties)}
        />

        <ConfirmDialog
          closeOnBackEvent
          closeOnDimmerClick
          description="게임을 나가면 현재 기록이 초기화돼요."
          open={leaveGameDialogOpen}
          title="게임을 나갈까요?"
          onClose={closeLeaveGameDialog}
          cancelButton={(
            <ConfirmDialog.CancelButton onClick={closeLeaveGameDialog}>
              계속하기
            </ConfirmDialog.CancelButton>
          )}
          confirmButton={(
            <ConfirmDialog.ConfirmButton color="danger" onClick={confirmLeaveGame}>
              나가기
            </ConfirmDialog.ConfirmButton>
          )}
        />
        <ConfirmDialog
          closeOnBackEvent
          closeOnDimmerClick
          description="현재 결과와 모든 점수가 폐기되며 되돌릴 수 없어요."
          open={discardResultDialogOpen}
          title="현재 결과를 폐기할까요?"
          onClose={closeDiscardResultDialog}
          cancelButton={(
            <ConfirmDialog.CancelButton onClick={closeDiscardResultDialog}>
              결과 유지
            </ConfirmDialog.CancelButton>
          )}
          confirmButton={(
            <ConfirmDialog.ConfirmButton color="danger" onClick={confirmDiscardResult}>
              폐기하고 다시 하기
            </ConfirmDialog.ConfirmButton>
          )}
        />
      </section>
    </main>
  )
}

function TopBar({ title, progress, onBack }) {
  return (
    <header className="top-bar">
      {onBack ? (
        <IconButton
          aria-label="이전 화면"
          bgColor="transparent"
          src="https://static.toss.im/icons/svg/icon-arrow-left-mono.svg"
          variant="clear"
          onClick={onBack}
        />
      ) : <span aria-hidden="true" />}
      <strong>{title}</strong>
      <span className="progress-pill">{progress}</span>
    </header>
  )
}

function StartScreen({ draft, recentGroups, recentSettlement, onOpenRecent, onResume, onReuseGroup, onStart }) {
  return (
    <section className="screen start-screen" aria-labelledby="start-title">
      <TdsTitle
        centered
        id="start-title"
        title={<>오늘 정산,<br /><span>재미있게 결정해요</span></>}
        subtitle="금액과 참여자를 입력하면 각자 낼 금액을 계산해 드려요"
      />
      <div className="hero-illustration settlement-visual" aria-hidden="true">
        <div className="settlement-visual-card primary-card">
          <span className="icon-bubble"><Icon>payments</Icon></span>
          <i />
          <i />
          <strong>₩15,000</strong>
        </div>
        <div className="settlement-visual-card back-card" />
        <span className="settlement-coin coin-one"><Icon>paid</Icon></span>
        <span className="settlement-coin coin-two"><Icon>person</Icon></span>
      </div>
      {draft && (
        <button className="recent-settlement-card draft-card" type="button" onClick={onResume}>
          <span className="icon-bubble"><Icon>edit_note</Icon></span>
          <span className="recent-settlement-copy">
            <small>작성 중인 정산</small>
            <strong>{draft.settlementTitle || '이름 없는 정산'}</strong>
            <span>{draft.amount ? formatWon(draft.amount) : '금액 입력 전'} · {draft.participants?.length || 0}명</span>
          </span>
          <Icon>chevron_right</Icon>
        </button>
      )}
      {draft && <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onResume}>이어서 정산하기</Button>}
      {recentSettlement && (
        <button className="recent-settlement-card" type="button" onClick={() => onOpenRecent(recentSettlement)}>
          <span className="icon-bubble"><Icon>history</Icon></span>
          <span className="recent-settlement-copy">
            <small>최근 정산</small>
            <strong>{recentSettlement.title}</strong>
            <span>{formatWon(recentSettlement.amount)} · {recentSettlement.participants.length}명</span>
          </span>
          <Icon>chevron_right</Icon>
        </button>
      )}
      {recentGroups?.length > 0 && (
        <div className="recent-group-list" aria-label="최근 모임">
          <small>최근 모임으로 빠르게 시작</small>
          {recentGroups.slice(0, 2).map((group) => (
            <Button color="dark" key={group.id} size="small" type="button" variant="weak" onClick={() => onReuseGroup(group)}>
              {group.participants.join(', ')} · {group.usageCount}회
            </Button>
          ))}
        </div>
      )}
      <ScreenCTA testId="start-settlement" onClick={onStart}>정산 시작하기</ScreenCTA>
    </section>
  )
}

function TitleScreen({ title, onChangeTitle, onNext }) {
  return (
    <section className="screen title-screen" aria-labelledby="title-entry-title">
      <TdsTitle id="title-entry-title" subtitle="선택 사항이에요. 비워 두고 바로 진행해도 돼요." title="어떤 정산인가요?" />
      <form
        className="title-form"
        onSubmit={(event) => {
          event.preventDefault()
          onNext()
        }}
      >
        <TextField
          aria-label="정산 타이틀"
          data-testid="settlement-title-input"
          label="정산 타이틀"
          labelOption="sustain"
          placeholder="예: 강남역 삼겹살 모임"
          value={title}
          variant="box"
          onChange={(event) => onChangeTitle(event.target.value)}
        />
      </form>
      <div className="tip-card"><Icon>edit_note</Icon> 정산 이름은 나중에 기록을 찾기 위한 선택 항목이에요.</div>
      <ScreenCTA testId="title-next" onClick={onNext}>금액 입력하기</ScreenCTA>
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
      <ScreenCTA disabled={amount <= 0} testId="amount-next" onClick={onNext}>참여자 입력하기</ScreenCTA>
    </section>
  )
}

function ParticipantsScreen({ participants, newParticipant, participantMessage, onChangeName, onSubmit, onRemove, onNext }) {
  const reachedParticipantLimit = participants.length >= maxParticipants
  const visibleMessage = reachedParticipantLimit
    ? `최대 ${maxParticipants}명까지 참여할 수 있어요.`
    : participantMessage

  return (
    <section className="screen participants-screen" aria-labelledby="participants-title">
      <TdsTitle id="participants-title" subtitle="정산에 참여한 멤버들을 추가해 주세요." title="누가 함께했나요?" />
      <form className="participant-form" onSubmit={onSubmit}>
        <TextField
          aria-label="참여자 이름"
          aria-describedby={visibleMessage ? 'participant-message' : undefined}
          label="참여자 이름"
          labelOption="sustain"
          placeholder="이름 입력"
          right={<Button color="primary" disabled={reachedParticipantLimit} size="small" type="submit">추가</Button>}
          value={newParticipant}
          variant="box"
          onChange={(event) => onChangeName(event.target.value)}
        />
      </form>
      {visibleMessage && <p id="participant-message" className="form-message" role="status">{visibleMessage}</p>}
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
      <div className="tip-card"><Icon>lightbulb</Icon> 참여자는 2명부터 최대 8명까지 추가할 수 있어요.</div>
      <ScreenCTA disabled={participants.length < 2} testId="participants-next" onClick={onNext}>정산 방식 고르기</ScreenCTA>
    </section>
  )
}

function MethodScreen({ selected, onSelect, onNext }) {
  return (
    <section className="screen method-screen" aria-labelledby="method-title">
      <TdsTitle id="method-title" subtitle="원하는 정산 방식을 선택해 주세요." title="어떻게 나눌까요?" />
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
      <ScreenCTA testId="method-next" onClick={onNext}>{selected === 'equal' ? '결과 확인하기' : '게임 선택하기'}</ScreenCTA>
    </section>
  )
}

function ExemptScreen({ allowReselect, amount, people, splitAmount, onAllowReselectChange, onNext }) {
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
          <strong><Icon>person_search</Icon> 무작위 1명</strong>
        </div>
      </div>
      <div className="toggle-row switch-row">
        <span className="toggle-copy">
          <span><Icon>auto_awesome</Icon> 결과 재선택 허용</span>
          <small>기본은 잠금이며, 허용해도 결과 폐기 확인을 거쳐요.</small>
        </span>
        <Switch aria-label="결과 재선택 허용" checked={allowReselect} onChange={(_, checked) => onAllowReselectChange(checked)} />
      </div>
      <div className="preview-card">
        <strong><Icon>analytics</Icon> 예상 결과 미리보기</strong>
        <p>면제 1명 0원</p>
        <p>나머지 {people - 1}명 각 {formatWon(splitAmount)}</p>
      </div>
      <ScreenCTA testId="exempt-next" onClick={onNext}>게임 선택하기</ScreenCTA>
    </section>
  )
}

function getSettlementModeLabel(mode) {
  return settlementModes.find((item) => item.id === mode)?.title || '한 명 면제'
}

function getSettlementOutcomeLabel(mode) {
  if (mode === 'extra') {
    return '2인분 부담자'
  }

  if (mode === 'discount') {
    return '할인 대상'
  }

  return '면제자'
}

function getRankingWinnerText(mode, participant) {
  if (mode === 'extra') {
    return `${participant} 님 2인분 부담자로 확정`
  }

  if (mode === 'discount') {
    return `${participant} 님 50% 할인 적용`
  }

  return `${participant} 님 면제권 획득`
}
function SettlementRulePreview({ amount, participants, settlementMode, selectedParticipant }) {
  const preview = buildSettlementPreviewCore({ amount, participants, settlementMode, selectedParticipant })

  return (
    <div className="preview-card">
      <strong><Icon>analytics</Icon> 정산 적용 미리보기</strong>
      <p>{preview.rule}</p>
      <p>{preview.amounts}</p>
    </div>
  )
}

function GameSelectScreen({ amount, games, participants, selectedGameId, settlementMode, onSelect, onNext }) {
  return (
    <section className="screen game-select-screen" aria-labelledby="game-select-title">
      <TdsTitle id="game-select-title" subtitle="정산 방식에 어울리는 게임을 선택해 보세요." title="게임 선택하기" />
      <div className="summary-banner compact-summary">
        <span>선택한 정산 방식</span>
        <strong>{getSettlementModeLabel(settlementMode)}</strong>
        <Icon>sports_esports</Icon>
      </div>
      <SettlementRulePreview amount={amount} participants={participants} selectedParticipant={participants[0]} settlementMode={settlementMode} />
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
                <span className="game-card-meta">
                  <b>{game.category === 'random' ? '랜덤' : '순위'}</b>
                  <b>추천 {game.recommendedPlayers.min}~{game.recommendedPlayers.max}명</b>
                  <b>예상 {Math.max(10, Math.ceil((game.estimatedSecondsPerPlayer * participants.length) / 10) * 10)}초</b>
                </span>
                {participants.length > game.recommendedPlayers.max && (
                  <span className="game-duration-warning">현재 인원에서는 진행 시간이 길어질 수 있어요.</span>
                )}
              </span>
              <span className={selectedGameId === game.id ? 'game-check visible' : 'game-check'}><Icon>check_circle</Icon></span>
            </button>
          </li>
        ))}
      </ul>
      <ScreenCTA testId="game-select-next" onClick={onNext}>게임 시작하기</ScreenCTA>
    </section>
  )
}

function GameRulesScreen({ amount, game, participants, settlementMode, winner, onNext }) {
  const outcomeLabel = getSettlementOutcomeLabel(settlementMode)
  const targetRankLabel = settlementMode === 'extra' ? '꼴등' : '1등'
  const targetRuleTitle = settlementMode === 'extra' ? '꼴등 2인분 부담' : `1등 ${outcomeLabel}`
  const targetRuleCopy = settlementMode === 'extra'
    ? '순위형 게임은 꼴등에게 2인분 부담을 적용해요.'
    : '순위형 게임은 1등에게 선택한 정산 방식을 적용해요.'

  return (
    <section className="screen game-rules-screen" aria-labelledby="game-rules-title">
      <TdsTitle id="game-rules-title" subtitle={game.description} title="게임 규칙 안내" />
      <div className="game-hero-card">
        <span className="game-icon large"><Icon>{game.icon}</Icon></span>
        <strong>{game.title}</strong>
        <p>{game.rule}</p>
      </div>
      <div className="rule-grid">
        <div><Icon>looks_one</Icon><strong>한 명씩 플레이</strong><small>참여자 순서대로 이 게임을 진행해요.</small></div>
        {game.id === 'reaction' && <div><Icon>touch_app</Icon><strong>한 번만 클릭</strong><small>지금 누르세요! 전에 누르면 신호 전 클릭으로 꼴등 처리돼요.</small></div>}
        <div><Icon>workspace_premium</Icon><strong>{targetRuleTitle}</strong><small>{targetRuleCopy}</small></div>
        <div><Icon>restart_alt</Icon><strong>동점 재대결</strong><small>{targetRankLabel}이 동점이면 재대결 화면에서 확정해요.</small></div>
      </div>
      <SettlementRulePreview amount={amount} participants={participants} selectedParticipant={winner} settlementMode={settlementMode} />
      <ScreenCTA testId="game-rules-next" onClick={onNext}>플레이 순서 확인</ScreenCTA>
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

function ParticipantTurnScreen({ abortReason, participant, progress, onNext }) {
  return (
    <section className="screen participant-turn-screen" aria-labelledby="turn-title">
      <TdsTitle centered id="turn-title" subtitle={`${progress} 플레이어`} title="참여자 전환" />
      <div className="turn-card" aria-atomic="true" aria-live="polite" role="status">
        <span className="avatar giant">{participant}</span>
        <strong>{participant} 님 차례예요</strong>
        <p>다른 사람의 기록이 보이지 않게 이 기기를 넘긴 뒤 시작해 주세요.</p>
      </div>
      {abortReason === 'background' && (
        <p className="info-card" aria-live="polite">앱이 백그라운드로 이동해 이번 기록을 폐기했어요.</p>
      )}
      <ScreenCTA testId="participant-turn-start" onClick={onNext}>시작하기</ScreenCTA>
    </section>
  )
}

function RandomGameScreen({ game, participants, onComplete }) {
  return <ReceiptEnvelopeGameScreen game={game} participants={participants} onComplete={onComplete} />
}

function ReceiptEnvelopeGameScreen({ game, participants, onComplete }) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const revealTimerRef = useRef(null)
  const assignmentResult = useMemo(() => {
    try {
      return {
        assignments: createEnvelopeAssignments(participants),
        error: '',
      }
    } catch {
      return {
        assignments: [],
        error: '안전한 무작위 선택을 사용할 수 없어요. 이전 화면에서 다시 시도해 주세요.',
      }
    }
  }, [participants])

  useEffect(() => () => {
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current)
    }
  }, [])

  function selectEnvelope(index) {
    if (selectedIndex != null || assignmentResult.error) {
      return
    }

    setSelectedIndex(index)
    revealTimerRef.current = window.setTimeout(() => {
      onComplete(assignmentResult.assignments[index])
    }, 600)
  }

  return (
    <section className="screen random-game-screen receipt-envelope-screen" aria-labelledby="receipt-envelope-title">
      <TdsTitle centered id="receipt-envelope-title" subtitle="봉투 하나를 고르면 0.6초 뒤 숨겨진 이름이 공개돼요." title={game.title} />
      <div className="fairness-card" role="note">
        <Icon>verified_user</Icon>
        <span>
          <strong>모든 참여자의 선택 확률은 1/{participants.length}이에요.</strong>
          <small>이름은 화면이 열릴 때 봉투마다 하나씩 무작위로 배정돼요.</small>
        </span>
      </div>
      {assignmentResult.error && <p className="game-error" role="alert">{assignmentResult.error}</p>}
      <div className="envelope-grid">
        {participants.map((participant, index) => (
          <button
            className={selectedIndex === index ? 'receipt-envelope selected-envelope' : 'receipt-envelope'}
            data-testid={`receipt-envelope-${index + 1}`}
            disabled={selectedIndex != null || Boolean(assignmentResult.error)}
            key={participant}
            type="button"
            onClick={() => selectEnvelope(index)}
          >
            <Icon>{selectedIndex === index ? 'mark_email_read' : 'drafts'}</Icon>
            <span>#{index + 1}</span>
            <small>{selectedIndex === index ? '봉투를 여는 중' : '영수증 봉투'}</small>
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {selectedIndex == null ? '선택할 봉투를 골라 주세요.' : `${selectedIndex + 1}번 봉투를 열고 있어요.`}
      </p>
    </section>
  )
}

function RankingGameScreen({ game, participant, playerIndex = 0, previousScores = [], onAbort, onComplete }) {
  const [measuredScore, setMeasuredScore] = useState(null)
  const needsCountdown = Boolean(game.requiresCountdownReady)
  const [readyToPlay, setReadyToPlay] = useState(!needsCountdown)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        onAbort?.('background')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [onAbort])

  useEffect(() => {
    setMeasuredScore(null)

    if (!needsCountdown) {
      setReadyToPlay(true)
      return undefined
    }

    setReadyToPlay(false)
    setCountdown(3)
    return undefined
  }, [game.id, needsCountdown, participant])

  useEffect(() => {
    if (!needsCountdown || readyToPlay) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setCountdown((current) => {
        if (current <= 1) {
          setReadyToPlay(true)
          return current
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [countdown, needsCountdown, readyToPlay])

  const isPreparing = needsCountdown && !readyToPlay
  const completionDisabled = measuredScore == null

  return (
    <section className={`screen ranking-game-screen ${game.id}-screen${isPreparing ? ' preparing-countdown' : ''}`} aria-labelledby="ranking-game-title">
      <TdsTitle centered id="ranking-game-title" subtitle={`${participant} 님의 기록을 측정해요.`} title={game.title} />
      <div className={isPreparing ? 'ranking-game-content preparing' : 'ranking-game-content'}>
        {isPreparing && <RankingGamePreview game={game} />}
        {readyToPlay && game.id === 'reaction' && <ReactionGameScreen game={game} participant={participant} previousScores={previousScores} onScore={setMeasuredScore} />}
        {readyToPlay && game.id === 'fiveSeconds' && <FiveSecondGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
        {readyToPlay && game.id === 'timingStop' && <TimingStopGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
        {readyToPlay && game.id === 'numberOrder' && <NumberOrderGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
        {readyToPlay && game.id === 'memoryCard' && <MemoryCardGameScreen game={game} participant={participant} onScore={setMeasuredScore} />}
      </div>
      <ScreenCTA disabled={completionDisabled} icon="check" testId="complete-game-turn" onClick={() => onComplete(measuredScore)}>이번 차례 완료</ScreenCTA>
      {isPreparing && <GameCountdownOverlay count={countdown} game={game} />}
    </section>
  )
}

function RankingGamePreview({ game }) {
  const memoryTiles = ['🍀', '⭐', '🎈', '🚀', '🍉', '🎵', '🍀', '⭐', '🎈', '🚀', '🍉', '🎵']
  const numberTiles = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className={`game-play-stage ${game.id}-stage countdown-preview`} aria-hidden="true">
      {game.id === 'reaction' && <button className="reaction-pad waiting" type="button" disabled>기다려주세요</button>}
      {game.id === 'timingStop' && <div className="timing-track"><i /><b /></div>}
      {game.id === 'numberOrder' && (
        <div className="number-board">
          {numberTiles.map((tile) => <button key={tile} type="button" disabled>{tile}</button>)}
        </div>
      )}
      {game.id === 'memoryCard' && (
        <div className="memory-board">
          {memoryTiles.map((tile, index) => <button className="memory-card flipped" key={`${tile}-${index}`} type="button" disabled>{tile}</button>)}
        </div>
      )}
    </div>
  )
}

function GameCountdownOverlay({ count, game }) {
  const descriptions = {
    reaction: '신호가 뜨면 바로 탭하세요...',
    timingStop: '목표 지점에 맞춰 멈출 준비 중...',
    numberOrder: '1부터 9까지 순서대로 누를 준비를 해 주세요...',
    memoryCard: '카드 위치를 기억할 준비를 해 주세요...',
  }

  return (
    <div
      className="game-countdown-overlay"
      data-testid="game-countdown-overlay"
      aria-atomic="true"
      aria-live="assertive"
      role="status"
    >
      <strong>준비하세요!</strong>
      <span data-testid="game-countdown-number">{count}</span>
      <small>{descriptions[game.id] || '곧 게임이 시작돼요...'}</small>
    </div>
  )
}
function ReactionGameScreen({ game, participant, previousScores = [], onScore }) {
  const [state, setState] = useState('waiting')
  const [result, setResult] = useState(null)
  const signalAtRef = useRef(0)
  const signalTimerRef = useRef(null)
  const stateCopy = {
    waiting: { headline: '기다려주세요', subline: '신호가 뜨면 바로 탭하세요' },
    signal: { headline: '지금 누르세요!', subline: '지금 바로 탭하세요!' },
    early: { headline: '너무 빨랐어요!', subline: '신호 전 클릭으로 꼴등 처리돼요.' },
    done: { headline: result ? `${(result.reactionMs / 1000).toFixed(3)}초` : '', subline: '기록 완료' },
  }
  const currentCopy = stateCopy[state] || stateCopy.waiting
  const actionIcon = state === 'waiting' ? 'hourglass_empty' : state === 'early' ? 'block' : 'touch_app'
  const reactionStats = result ? getReactionResultStats(result.reactionMs, previousScores) : null

  function armSignal() {
    if (signalTimerRef.current) {
      window.clearTimeout(signalTimerRef.current)
    }

    setState('waiting')
    setResult(null)
    const signalDelay = getReactionDelayMs()
    signalTimerRef.current = window.setTimeout(() => {
      signalAtRef.current = performance.now()
      setState('signal')
    }, signalDelay)
  }

  useEffect(() => {
    armSignal()
    return () => {
      if (signalTimerRef.current) {
        window.clearTimeout(signalTimerRef.current)
      }
    }
  }, [participant])

  function tap() {
    if (state === 'done' || state === 'early') {
      return
    }

    if (state !== 'signal') {
      if (signalTimerRef.current) {
        window.clearTimeout(signalTimerRef.current)
        signalTimerRef.current = null
      }

      setState('early')
      setResult({ earlyTap: true })
      onScore(createMeasuredGameScore({
        detail: { earlyTap: true },
        displayScore: '신호 전 클릭',
        gameId: game.id,
        metric: earlyReactionRankMetric,
        participant,
        rawScore: earlyReactionRankMetric,
      }))
      return
    }

    const reactionMs = Math.max(0, performance.now() - signalAtRef.current)
    setState('done')
    setResult({ reactionMs })
    onScore(createMeasuredGameScore({ detail: { reactionMs }, displayScore: reactionMs, gameId: game.id, metric: reactionMs, participant, rawScore: reactionMs }))
  }

  return (
    <div className={`game-play-stage reaction-stage ${state}`}>
      <div className="reaction-turn-card">
        <span className="avatar mini">{participant.slice(0, 1)}</span>
        <span>
          <small>현재 순서</small>
          <strong>{participant}님의 차례</strong>
        </span>
        <i aria-hidden="true" />
      </div>
      <button className={`reaction-pad ${state}`} data-testid="reaction-action" type="button" disabled={state === 'done' || state === 'early'} onClick={tap}>
        <Icon>{actionIcon}</Icon>
      </button>
      {state === 'done' && reactionStats ? (
        <div className="reaction-result-panel" data-testid="reaction-result-panel" aria-live="polite">
          <span className="reaction-result-icon"><Icon>bolt</Icon></span>
          <strong>{(result.reactionMs / 1000).toFixed(3)}초</strong>
          <p>{getReactionFeedback(result.reactionMs)}</p>
          <div className="reaction-result-divider" />
          <div className="reaction-result-stats">
            <span>
              <small>평균 대비</small>
              <b>{reactionStats.averageDiffText}</b>
            </span>
            <span>
              <small>현재 순위</small>
              <b>{reactionStats.rank}위</b>
            </span>
          </div>
        </div>
      ) : (
        <div className="reaction-copy">
          <strong>{currentCopy.headline}</strong>
          <span>{currentCopy.subline}</span>
        </div>
      )}
    </div>
  )
}

function getReactionResultStats(reactionMs, previousScores) {
  const previousReactionScores = previousScores.filter((score) => score.gameId === 'reaction' && !score.detail?.earlyTap && typeof score.rankMetric === 'number')
  const allMetrics = [...previousReactionScores.map((score) => score.rankMetric), reactionMs]
  const averageMs = allMetrics.reduce((sum, metric) => sum + metric, 0) / Math.max(1, allMetrics.length)
  const diffSeconds = (reactionMs - averageMs) / 1000
  const rank = previousReactionScores.filter((score) => score.rankMetric < reactionMs).length + 1

  return {
    averageDiffText: formatSignedSeconds(diffSeconds),
    rank,
  }
}

function formatSignedSeconds(value) {
  if (Math.abs(value) < 0.005) {
    return '0.00초'
  }

  return `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(2)}초`
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

    const intervalId = window.setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000)
    }, 50)
    const autoStopId = window.setTimeout(() => {
      finish(Date.now())
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(autoStopId)
    }
  }, [running, startedAt])

  function start() {
    if (running || result) {
      return
    }

    const now = Date.now()
    setStartedAt(now)
    setElapsed(0)
    setRunning(true)
  }

  function finish(finishedAt) {
    const elapsedMs = Math.min(10000, Math.max(0, finishedAt - startedAt))
    const nextResult = calculateFiveSecondResult(elapsedMs)
    setElapsed(nextResult.elapsedMs / 1000)
    setResult(nextResult)
    setRunning(false)
    onScore(createMeasuredGameScore({
      detail: {
        diffMs: nextResult.diffMs,
        elapsedMs: nextResult.elapsedMs,
      },
      displayScore: (nextResult.elapsedMs / 1000).toFixed(3),
      gameId: game.id,
      metric: nextResult.rankMetric,
      participant,
      rawScore: nextResult.elapsedMs / 1000,
    }))
  }

  function stop() {
    if (!running || result) {
      return
    }

    finish(Date.now())
  }

  return (
    <div className="game-play-stage five-second-stage">
      <div className={running && elapsed >= 1 ? 'five-second-dial blurred-time' : 'five-second-dial'}>
        <strong>{elapsed.toFixed(3)}</strong>
        <span>5.000</span>
      </div>
      <div className="game-action-row">
        <Button data-testid="five-second-start" color="primary" size="large" type="button" variant="weak" disabled={running || result != null} onClick={start}>시작</Button>
        <Button data-testid="five-second-stop" color="primary" size="large" type="button" disabled={!running || result != null} onClick={stop}>멈추기</Button>
      </div>
      {result && <strong className="game-live-score">오차 {(result.diffMs / 1000).toFixed(3)}초</strong>}
    </div>
  )
}

function TimingStopGameScreen({ game, participant, onScore }) {
  const [position, setPosition] = useState(0)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState(null)
  const frameRef = useRef(null)
  const positionRef = useRef(0)
  const direction = useMemo(() => getTimingStartDirection(), [participant])

  useEffect(() => {
    if (done) {
      return undefined
    }

    const startedAt = performance.now()

    function animate(timestamp) {
      const nextPosition = calculateTimingStopPosition(timestamp - startedAt, 1600, direction)
      positionRef.current = nextPosition
      setPosition(nextPosition)
      frameRef.current = window.requestAnimationFrame(animate)
    }

    frameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [direction, done, participant])

  function stop() {
    if (done) {
      return
    }

    const finalPosition = positionRef.current
    const timingResult = calculateTimingResult(finalPosition)
    const grade = getTimingGrade(timingResult.scoreValue)
    setDone(true)
    setPosition(finalPosition)
    setResult({ ...timingResult, grade })
    onScore(createMeasuredGameScore({
      detail: { ...timingResult, grade },
      displayScore: timingResult.scoreValue.toFixed(1),
      gameId: game.id,
      metric: timingResult.rankMetric,
      participant,
      rawScore: timingResult.scoreValue,
    }))
  }

  return (
    <div className="game-play-stage timing-stage">
      <div className="timing-turn-card">
        <span className="avatar mini">{participant.slice(0, 1)}</span>
        <span>
          <small>현재 순서</small>
          <strong>{participant}님의 차례</strong>
        </span>
        <i aria-hidden="true" />
      </div>
      <div className="timing-arena">
        <div className="timing-track">
          <span className="timing-target-zone" />
          <span className="timing-center-line" />
          <span className="timing-pointer" style={{ left: `${position}%` }} />
        </div>
        <div className="timing-status-copy">
          <strong>{result ? `${result.scoreValue.toFixed(1)}점` : '중앙에 맞춰 멈춰요'}</strong>
          <span>{result ? `중앙에서 ${result.distance.toFixed(1)}pt 차이` : '포인터가 타깃 중앙에 겹치는 순간을 노려보세요.'}</span>
        </div>
      </div>
      {/* {result && (
        <div className="timing-result-panel" data-testid="timing-result-panel" aria-live="polite">
          <span className={`timing-grade-badge ${result.grade.toLowerCase()}`}>{getTimingGradeLabel(result.grade)}</span>
          <span>
            <small>최종 점수</small>
            <strong>{result.scoreValue.toFixed(1)}점</strong>
          </span>
          <span>
            <small>오차</small>
            <strong>중앙에서 {result.distance.toFixed(1)}pt 차이</strong>
          </span>
        </div>
      )} */}
      <Button data-testid="timing-stop" color="primary" display="full" size="large" type="button" disabled={done} onClick={stop}>멈추기</Button>
    </div>
  )
}

function getTimingGrade(scoreValue) {
  if (scoreValue >= 99) {
    return 'PERFECT'
  }

  if (scoreValue >= 90) {
    return 'GREAT'
  }

  if (scoreValue >= 70) {
    return 'GOOD'
  }

  return 'MISS'
}

function NumberOrderGameScreen({ game, participant, onScore }) {
  const layoutResult = useMemo(() => {
    try {
      return { error: '', tiles: createBalancedNumberLayout() }
    } catch {
      return { error: '균형 잡힌 숫자 배열을 준비하지 못했어요.', tiles: [] }
    }
  }, [participant])
  const [startedAt] = useState(() => Date.now())
  const [nextNumber, setNextNumber] = useState(1)
  const [mistakes, setMistakes] = useState(0)
  const [done, setDone] = useState(false)

  function press(tile) {
    if (done) {
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
      {layoutResult.error && <p className="game-error" role="alert">{layoutResult.error}</p>}
      <div className="number-board">
        {layoutResult.tiles.map((tile) => (
          <button data-testid={`number-tile-${tile}`} key={tile} type="button" disabled={done || tile < nextNumber} onClick={() => press(tile)}>
            {tile}
          </button>
        ))}
      </div>
      <strong className="game-live-score">
        다음 숫자: {Math.min(nextNumber, 9)} / 실수: {mistakes}회{done ? ' / 벌점 반영 완료' : ''}
      </strong>
    </div>
  )
}

function MemoryCardGameScreen({ game, participant, onScore }) {
  const deckResult = useMemo(() => {
    try {
      return { cards: createMemoryDeck(), error: '' }
    } catch {
      return { cards: [], error: '기억 카드 구성을 준비하지 못했어요.' }
    }
  }, [participant])
  const [memorizing, setMemorizing] = useState(true)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [selected, setSelected] = useState([])
  const [matched, setMatched] = useState([])
  const [attempts, setAttempts] = useState(0)
  const [mismatches, setMismatches] = useState(0)
  const hideMismatchTimerRef = useRef(null)

  useEffect(() => {
    if (deckResult.error) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setStartedAt(Date.now())
      setMemorizing(false)
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
      if (hideMismatchTimerRef.current != null) {
        window.clearTimeout(hideMismatchTimerRef.current)
      }
    }
  }, [deckResult.error, participant])

  function flip(index) {
    if (deckResult.error || memorizing || matched.includes(index) || selected.includes(index) || selected.length >= 2) {
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

    if (deckResult.cards[first] === deckResult.cards[second]) {
      const nextMatched = [...matched, first, second]
      setMatched(nextMatched)
      setSelected([])
      if (nextMatched.length === deckResult.cards.length) {
        const elapsedMs = Date.now() - startedAt
        const penaltyMs = mismatches * 500
        const metric = elapsedMs + penaltyMs
        onScore(createMeasuredGameScore({
          detail: { attempts: nextAttempts, elapsedMs, mismatches, penaltyMs },
          displayScore: (metric / 1000).toFixed(3),
          gameId: game.id,
          metric,
          participant,
          rawScore: metric,
        }))
      }
      return
    }

    setMismatches((current) => current + 1)
    hideMismatchTimerRef.current = window.setTimeout(() => setSelected([]), 400)
  }

  return (
    <div className="game-play-stage memory-card-stage">
      <div className="memory-status" aria-live="polite">
        {memorizing ? '카드 위치를 기억하세요' : `시도 ${attempts}회 · 오답 ${mismatches}회`}
      </div>
      {deckResult.error && <p className="game-error" role="alert">{deckResult.error}</p>}
      <div className="memory-board">
        {deckResult.cards.map((card, index) => {
          const visible = memorizing || selected.includes(index) || matched.includes(index)
          return (
            <button
              aria-label={visible ? `${card} 카드` : `${index + 1}번 뒤집힌 카드`}
              className={visible ? 'memory-card flipped' : 'memory-card'}
              data-testid={`memory-card-${index}`}
              key={`${card}-${index}`}
              type="button"
              disabled={memorizing || matched.includes(index) || selected.length >= 2}
              onClick={() => flip(index)}
            >
              {visible ? card : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RankingResultScreen({ game, scores, settlementMode, onNext }) {
  const targetScores = getSettlementTargetScores(scores, settlementMode)
  const targetScore = targetScores[0]
  const targetRankLabel = settlementMode === 'extra' ? '꼴등' : '1등'

  return (
    <section className="screen ranking-result-screen" aria-labelledby="ranking-result-title" aria-live="polite">
      <TdsTitle centered id="ranking-result-title" subtitle={`${game.title} 결과`} title="전체 순위 결과" />
      <div className="winner-summary">
        <span className="winner-medal">{targetRankLabel}</span>
        <strong>{targetScore ? getRankingWinnerText(settlementMode, targetScore.participant) : ''}</strong>
        <small>{targetScore ? getGameScoreLabel(game, targetScore) : ''}</small>
      </div>
      <ol className="ranking-list">
        {scores.map((score) => (
          <li className={targetScores.some((target) => target.participant === score.participant) ? 'rank-row first' : 'rank-row'} key={score.participant}>
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

function TieRematchScreen({ settlementMode, tiedScores, onStartRematch }) {
  const outcomeLabel = getSettlementOutcomeLabel(settlementMode)

  return (
    <section className="screen tie-rematch-screen" aria-labelledby="tie-rematch-title">
      <TdsTitle centered id="tie-rematch-title" subtitle="동점인 참여자끼리 한 번 더 대결해 순위를 정해요." title="동점자가 나왔어요!" />
      <div className="tie-rematch-matchup multi" data-testid="tie-rematch-matchup">
        <div className="tie-rematch-summary">
          <Icon>groups</Icon>
          <span>
            <strong>재대결 대상 {tiedScores.length}명</strong>
            <small>대상자 전체 목록</small>
          </span>
        </div>
        {tiedScores.map((score) => (
          <div className="tie-rematch-player-card compact" data-testid="tie-rematch-player-card" key={score.participant}>
            <span className="avatar">{score.participant.slice(0, 1)}</span>
            <span className="tie-rematch-player-copy">
              <small>{outcomeLabel} 후보</small>
              <strong>{score.participant}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="tie-rule-card" data-testid="tie-rematch-rule">
        <span><Icon>gavel</Icon></span>
        <p>
          <strong>재대결 규칙</strong>
          이전 게임을 한 번 더 진행하여, 동점자 사이의 최종 순위를 가려냅니다.
        </p>
      </div>
      <ScreenCTA icon="replay" testId="tie-rematch-start" onClick={onStartRematch}>재대결 시작하기</ScreenCTA>
    </section>
  )
}

function RouletteScreen({ amount, duration, error, participants, rotation, settlementMode, spinning, onSpin }) {
  const gradient = createRouletteGradient(participants.length)

  return (
    <section className="screen roulette-screen" aria-labelledby="roulette-title">
      <TdsTitle centered id="roulette-title" subtitle={spinning ? '잠시만 기다려 주세요. 정산 대상자를 고르고 있어요.' : `${getSettlementModeLabel(settlementMode)} 대상자를 룰렛으로 정해요.`} title="오늘의 정산 결과는?" />
      <div className="fairness-card" role="note">
        <Icon>verified_user</Icon>
        <span>
          <strong>모든 참여자의 선택 확률은 1/{participants.length}이에요.</strong>
          <small>결과를 먼저 확정한 뒤 룰렛이 선택된 구간에 멈춰요.</small>
        </span>
      </div>
      {error && <p className="game-error" role="alert">{error}</p>}
      <div className="roulette-stage">
        <div className="roulette-pointer" aria-hidden="true"><Icon>arrow_drop_down</Icon></div>
        <div
          className={spinning ? 'roulette-wheel spinning' : 'roulette-wheel'}
          aria-label={`${participants.join(', ')} 룰렛`}
          style={{
            '--participant-count': participants.length,
            background: `radial-gradient(circle at 50% 50%, var(--surface) 0 27%, transparent 28%), ${gradient}`,
            transform: `rotate(${rotation}deg)`,
            transitionDuration: `${duration}ms`,
          }}
        >
          <div className="roulette-core">
            <Icon>{spinning ? 'sync' : 'published_with_changes'}</Icon>
            <strong aria-live="polite">{spinning ? '선택 중' : '준비 완료'}</strong>
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
      <div className="roulette-draw-actions">
        <Button
          data-testid="roulette-wheel-draw"
          color="primary"
          disabled={spinning || Boolean(error)}
          display="full"
          size="large"
          type="button"
          onClick={() => onSpin('wheel')}
        >
          <Icon>{spinning ? 'sync' : 'refresh'}</Icon> {spinning ? '룰렛 돌리는 중' : '룰렛 돌리기'}
        </Button>
        <Button
          data-testid="roulette-quick-draw"
          color="primary"
          disabled={spinning || Boolean(error)}
          display="full"
          size="large"
          type="button"
          variant="weak"
          onClick={() => onSpin('quick')}
        >
          <Icon>bolt</Icon> 빠르게 뽑기
        </Button>
      </div>
    </section>
  )
}

function getTimingGradeLabel(grade) {
  return {
    PERFECT: '정확',
    GREAT: '훌륭',
    GOOD: '좋음',
    MISS: '아쉬움',
  }[grade] || '기록 완료'
}

function RouletteResultScreen({ amount, canRetry, settlementMode, settlementResult, winner, onRetry, onNext }) {
  const modeLabel = getSettlementModeLabel(settlementMode)
  const isExemptMode = settlementMode === 'exempt'
  const selectedLine = settlementResult.lineItems.find((item) => item.participant === winner)
  const otherLine = settlementResult.lineItems.find((item) => item.participant !== winner)

  return (
    <section className="screen roulette-result-screen" aria-labelledby="roulette-result-title" aria-live="polite">
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
          <strong>{winner} 님 {isExemptMode ? '면제' : getSettlementOutcomeLabel(settlementMode)}</strong>
          <p>{isExemptMode ? `나머지 인원 각 ${otherLine?.amountText}` : selectedLine?.amountText}</p>
          <em>총 {formatWon(amount)}</em>
          <span className="result-kicker"><Icon>auto_awesome</Icon> {isExemptMode ? '면제 확정' : `${modeLabel} 적용`}</span>
        </div>
      </div>
      <TdsTitle centered id="roulette-result-title" subtitle={settlementResult.summaryText} title={isExemptMode ? `${winner} 님이 면제됐어요` : `${winner} 님이 선택됐어요`} />
      <div className="result-stats">
        <div><small>결제 총액</small><strong>{formatWon(amount)}</strong><Icon>receipt_long</Icon></div>
        <div><small>{getSettlementOutcomeLabel(settlementMode)}</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>{selectedLine?.description}</small><strong>{selectedLine?.amountText}</strong></div>
        {otherLine && <div><small>나머지 기준 금액</small><strong>{otherLine.amountText}</strong></div>}
      </div>
      <div className="button-row">
        {canRetry && <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</Button>}
        <Button color="primary" display="full" size="large" type="button" onClick={onNext}>금액 확인하기</Button>
      </div>
    </section>
  )
}

function RandomResultScreen({ amount, canRetry, game, settlementMode, settlementResult, winner, onRetry, onNext }) {
  const modeLabel = getSettlementModeLabel(settlementMode)
  const selectedLine = settlementResult.lineItems.find((item) => item.participant === winner)
  const otherLine = settlementResult.lineItems.find((item) => item.participant !== winner)

  return (
    <section className="screen roulette-result-screen random-result-screen" aria-labelledby="random-result-title" aria-live="polite">
      <div className="winner-illustration">
        <div className="winner-artwork" role="img" aria-label={`${winner} 님 추첨 결과 이미지`}>
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
        <div><small>{getSettlementOutcomeLabel(settlementMode)}</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>{selectedLine?.description}</small><strong>{selectedLine?.amountText}</strong></div>
        {otherLine && <div><small>나머지 기준 금액</small><strong>{otherLine.amountText}</strong></div>}
      </div>
      <div className="button-row">
        {canRetry && <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</Button>}
        <Button data-testid="random-result-next" color="primary" display="full" size="large" type="button" onClick={onNext}>금액 확인하기</Button>
      </div>
    </section>
  )
}

function FinalResultScreen({ amount, game, isGameResult = false, participants, settlementResult, settlementTitle, onRestart, onShare }) {
  const { openToast } = useWebToast({ exitOnUnmount: false })
  const [imageSaving, setImageSaving] = useState(false)

  async function handleSaveImage() {
    setImageSaving(true)
    try {
      const payload = buildSharePayload({
        amount,
        participants,
        settlementResult,
        settlementTitle,
      })
      const result = await saveSettlementImage(payload)
      if (result.mode !== 'canceled') {
        openToast('정산 이미지를 저장하거나 공유했어요.', { duration: 1800 })
      }
    } catch {
      openToast('이미지를 저장하지 못했어요.', { duration: 2200 })
    } finally {
      setImageSaving(false)
    }
  }

  return (
    <section className="screen final-screen" aria-labelledby="final-title">
      <div className="success-icon"><Icon>check_circle</Icon></div>
      <TdsTitle centered id="final-title" subtitle="총 정산 금액" title={isGameResult ? '게임 정산이 완료됐어요' : '정산이 완료됐어요'} />
      <strong className="settlement-title">{settlementTitle}</strong>
      <strong className="big-amount">{formatWon(amount)}</strong>
      <span className="mode-badge"><Icon>{isGameResult ? 'sports_esports' : 'payments'}</Icon> {isGameResult ? `${game?.title || '게임'} ${settlementResult.modeLabel} 적용` : `${settlementResult.modeLabel} 방식 적용`}</span>
      <ListHeader
        className="compact-list-header"
        title={<ListHeader.TitleParagraph>참여자별 금액</ListHeader.TitleParagraph>}
      />
      <ul className="tds-list result-list">
        {settlementResult.lineItems.map((item) => (
          <ListRow
            className={item.highlighted ? 'surface-row exempted' : 'surface-row'}
            key={item.participant}
            left={<span className="avatar">{item.participant.slice(0, 1)}</span>}
            contents={<TextStack description={item.description} title={item.participant} />}
            right={<b>{item.amountText}</b>}
          />
        ))}
      </ul>
      <div className="celebration-card"><Icon>celebration</Icon> {settlementResult.summaryText}</div>
      <div className="button-row">
        <Button color="primary" disabled={imageSaving} display="full" size="large" type="button" variant="weak" onClick={handleSaveImage}><Icon>image</Icon> {imageSaving ? '이미지 만드는 중' : '이미지로 저장'}</Button>
        <Button color="primary" display="full" size="large" type="button" variant="weak" onClick={onRestart}><Icon>refresh</Icon> 새로운 정산</Button>
      </div>
      <ScreenCTA icon="share" onClick={onShare}>결과 공유하기</ScreenCTA>
    </section>
  )
}

function HistoryScreen({ items, loading, onOpenDetail }) {
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return (
    <>
      <TopBar title="정산 내역" progress="전체" />
      <section className="screen history-screen" aria-labelledby="history-title">
        <h1 className="sr-only">정산 내역</h1>
        <div className="monthly-card">
          <span>누적 정산 금액</span>
          <h1 id="history-title">{formatWon(totalAmount)}</h1>
          <p><b>총 {items.length}건</b></p>
        </div>
        <ul className="tds-list history-list">
          {items.map((item) => (
            <ListRow
              as="button"
              className="surface-row history-row"
              key={item.id}
              left={<span className="icon-bubble"><Icon>receipt_long</Icon></span>}
              contents={<TextStack description={formatWon(item.amount)} meta={new Date(item.completedAt).toLocaleDateString('ko-KR')} title={item.title || item.modeLabel} />}
              right={<small>{item.participants.length}명 참여</small>}
              type="button"
              withArrow
              withTouchEffect
              onClick={() => onOpenDetail(item)}
            />
          ))}
        </ul>
        {loading && <div className="state-grid" role="status"><span>정산 내역을 불러오는 중이에요</span></div>}
        {!loading && items.length === 0 && <div className="state-grid"><span>아직 정산 내역이 없어요</span></div>}
        {items.length >= 2 && <HistoryBanner />}
      </section>
    </>
  )
}

function HistoryBanner() {
  const targetRef = useRef(null)

  useEffect(() => attachHistoryBanner({
    ads: TossAds,
    enabled: adsEnabled,
    groupId: bannerAdGroupId,
    target: targetRef.current,
  }), [])

  return <aside ref={targetRef} aria-label="광고" className="history-ad-banner" />
}

function DetailScreen({ record, onBack, onDelete, onShare }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const completedDate = new Date(record.completedAt).toLocaleDateString('ko-KR')

  return (
    <>
      <TopBar title="상세 내역" progress={completedDate} onBack={onBack} />
      <section className="screen detail-screen" aria-labelledby="detail-title">
        <TdsTitle id="detail-title" subtitle={`${completedDate} 완료한 정산`} title={record.title} />
        <div className="summary-banner"><span>총 결제 금액</span><strong>{formatWon(record.amount)}</strong><Icon>auto_awesome</Icon></div>
        <div className="detail-meta"><span><Icon>groups</Icon> 참여자 총 {record.participants.length}명</span><span>방식 {record.modeLabel}</span></div>
        <ul className="tds-list result-list">
          {record.lineItems.map((item) => (
            <ListRow
              className={item.highlighted ? 'surface-row exempted' : 'surface-row'}
              key={item.participant}
              left={<span className="avatar">{item.participant.slice(0, 1)}</span>}
              contents={<TextStack description={item.description} title={item.participant} />}
              right={<b>{item.amountText}</b>}
            />
          ))}
        </ul>
        <blockquote>{record.summaryText}</blockquote>
        <Button color="danger" display="full" size="large" type="button" onClick={() => setDeleteDialogOpen(true)}><Icon>delete</Icon> 정산 내역 삭제</Button>
        <ScreenCTA icon="share" onClick={onShare}>결과 다시 공유하기</ScreenCTA>
      </section>
      <ConfirmDialog
        closeOnBackEvent
        closeOnDimmerClick
        description="삭제한 정산 기록은 복구할 수 없어요."
        open={deleteDialogOpen}
        title="정산 내역을 삭제할까요?"
        onClose={() => setDeleteDialogOpen(false)}
        cancelButton={(
          <ConfirmDialog.CancelButton onClick={() => setDeleteDialogOpen(false)}>
            취소
          </ConfirmDialog.CancelButton>
        )}
        confirmButton={(
          <ConfirmDialog.ConfirmButton color="danger" onClick={onDelete}>
            삭제하기
          </ConfirmDialog.ConfirmButton>
        )}
      />
    </>
  )
}

function SettingsScreen({ analyticsOptOut, onAnalyticsOptOutChange, onClearAll }) {
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  return (
    <>
      <TopBar title="설정" progress="로컬 저장" />
      <section className="screen settings-screen" aria-labelledby="settings-title">
        <h1 className="sr-only" id="settings-title">설정</h1>
        <div className="info-card">
          <Icon>smartphone</Icon>
          <span>로그인 없이 이 기기에만 저장해요</span>
          <small>정산 초안과 내역은 AppsInToss 기기 저장소에 보관되며, 다른 사용자에게 자동으로 전송되지 않아요.</small>
        </div>
        <ListHeader className="compact-list-header" title={<ListHeader.TitleParagraph>일반</ListHeader.TitleParagraph>} />
        <ul className="tds-list">
          <SettingsRow icon="help" title="서비스 이용 안내" />
          <ListRow
            className="surface-row"
            left={<span className="icon-bubble"><Icon>analytics</Icon></span>}
            contents={<TextStack description="이름·정확한 금액·정산 제목은 수집하지 않아요" title="익명 사용 통계 수집 안 함" />}
            right={(
              <Switch
                aria-label="익명 사용 통계 수집 안 함"
                checked={analyticsOptOut}
                onChange={(_, checked) => onAnalyticsOptOutChange(checked)}
              />
            )}
          />
          <SettingsRow
            danger
            description="초안과 정산 내역을 이 기기에서 삭제합니다"
            icon="warning"
            title="앱 데이터 전체 삭제"
            onClick={() => setClearDialogOpen(true)}
          />
        </ul>
        <ListHeader className="compact-list-header" title={<ListHeader.TitleParagraph>약관 및 지원</ListHeader.TitleParagraph>} />
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
      <ConfirmDialog
        closeOnBackEvent
        closeOnDimmerClick
        description="작성 중인 초안과 모든 정산 내역이 삭제되며 복구할 수 없어요."
        open={clearDialogOpen}
        title="앱 데이터를 모두 삭제할까요?"
        onClose={() => setClearDialogOpen(false)}
        cancelButton={(
          <ConfirmDialog.CancelButton onClick={() => setClearDialogOpen(false)}>
            취소
          </ConfirmDialog.CancelButton>
        )}
        confirmButton={(
          <ConfirmDialog.ConfirmButton color="danger" onClick={onClearAll}>
            모두 삭제
          </ConfirmDialog.ConfirmButton>
        )}
      />
    </>
  )
}
function SettingsRow({ icon, title, description, danger = false, onClick }) {
  const interactiveProps = onClick
    ? {
        as: 'button',
        type: 'button',
        withArrow: true,
        withTouchEffect: true,
        onClick,
      }
    : {
        as: 'li',
        withArrow: false,
        withTouchEffect: false,
      }

  return (
    <ListRow
      {...interactiveProps}
      className={danger ? 'surface-row danger-row' : 'surface-row'}
      left={<span className="icon-bubble"><Icon>{icon}</Icon></span>}
      contents={<TextStack description={description} title={title} />}
    />
  )
}

function ShareSheet({ amount, gameId, open, participants, settlementMode, settlementResult, settlementTitle, onClose, onTrack }) {
  const { openToast } = useWebToast({ exitOnUnmount: false })
  const [shareActionPending, setShareActionPending] = useState(null)
  const payload = buildSharePayload({ amount, gameId, participants, settlementMode, settlementResult, settlementTitle })

  async function runShareAction(action, successMessage, errorMessage, shareMethod) {
    setShareActionPending(true)
    try {
      const result = await action()
      if (result?.mode !== 'canceled') {
        openToast(successMessage, { duration: 1800 })
        onTrack?.('share_completed', { share_method: shareMethod })
      }
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
    }, '토스 공유창을 열었어요.', '토스 공유를 열지 못했어요.', 'toss')
  }

  function handleCopyLink() {
    return runShareAction(async () => {
      await copySettlementLink(payload)
    }, '정산 링크를 복사했어요.', '링크를 복사하지 못했어요.', 'link')
  }

  function handleCopySummary() {
    return runShareAction(async () => {
      try {
        await setClipboardText(payload.message)
      } catch {
        await navigator.clipboard?.writeText(payload.message)
      }
    }, '송금용 정산 요약을 복사했어요.', '정산 요약을 복사하지 못했어요.', 'summary')
  }

  function handleSaveImage() {
    return runShareAction(async () => {
      return saveSettlementImage(payload)
    }, '정산 이미지를 저장했어요.', '이미지를 저장하지 못했어요.', 'image')
  }

  function handleKakaoShare() {
    return runShareAction(async () => {
      const tossLink = await getSettlementShareLink(payload)
      await share({ message: `카카오톡으로 공유해 주세요.\n${payload.message}\n${tossLink}` })
    }, '공유창에서 카카오톡을 선택해 주세요.', '카카오톡 공유를 열지 못했어요.', 'kakao')
  }

  const shareActions = [
    ['payments', '토스로 공유', handleTossShare],
    ['content_copy', '정산 요약 복사', handleCopySummary],
    ['link', '링크 복사', handleCopyLink],
    ['download', '이미지 저장', handleSaveImage],
    ['send', '카카오톡으로 바로 보내기', handleKakaoShare],
  ]

  return (
    <BottomSheet
      UNSAFE_disableFocusLock={import.meta.env.MODE === 'test'}
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
          <small>{new Date().toLocaleDateString('ko-KR')} · {participants.length}인 모임</small>
          <p>총 정산 금액</p>
          <b>₩{amount.toLocaleString('ko-KR')}</b>
          <span>{payload.modeLabel}</span>
        </div>
        <div className="share-members">
          {payload.lineItems.slice(0, 2).map((item) => (
            <span key={item.participant}>{item.participant} {item.amountText}</span>
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
              <Icon>{shareActionPending ? 'sync' : icon}</Icon>
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

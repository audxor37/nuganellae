import { useMemo, useState } from 'react'

const tabs = {
  home: 'home',
  history: 'history',
  settings: 'settings',
}

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

function formatWon(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>
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

  const paidParticipants = useMemo(
    () => participants.filter((participant) => participant !== winner),
    [participants, winner],
  )
  const effectiveAmount = amount || 84000
  const splitAmount = Math.ceil(effectiveAmount / Math.max(1, paidParticipants.length))

  function goHome(nextStep = steps.start) {
    setActiveTab(tabs.home)
    setStep(nextStep)
    setShareOpen(false)
  }

  function addAmount(value) {
    setAmount((current) => current + value)
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
      setStep(steps.exempt)
      return
    }

    setStep(steps.finalResult)
  }

  function spinRoulette() {
    const nextWinner = participants.includes('영희') ? '영희' : participants[participants.length - 1]
    setWinner(nextWinner)
    setStep(steps.rouletteResult)
  }

  return (
    <main className="app">
      <section className="phone-shell" aria-label="누가낼래 앱">
        {activeTab === tabs.home && step !== steps.detail && (
          <TopBar
            title="누가낼래"
            progress={step === steps.start ? '1/3' : step === steps.amount ? '1/3' : step === steps.participants ? '2/3' : '3/3'}
            onBack={() => (step === steps.start ? goHome(steps.start) : goHome(steps.start))}
          />
        )}

        {activeTab === tabs.history && (
          <HistoryScreen filter={filter} onFilter={setFilter} onOpenDetail={() => setStep(steps.detail)} />
        )}

        {activeTab === tabs.settings && <SettingsScreen />}

        {activeTab === tabs.home && step === steps.start && <StartScreen onStart={() => setStep(steps.amount)} />}
        {activeTab === tabs.home && step === steps.amount && (
          <AmountScreen amount={amount} onAddAmount={addAmount} onReset={() => setAmount(0)} onNext={() => setStep(steps.participants)} />
        )}
        {activeTab === tabs.home && step === steps.participants && (
          <ParticipantsScreen
            newParticipant={newParticipant}
            participants={participants}
            onChangeName={setNewParticipant}
            onRemove={removeParticipant}
            onSubmit={handleParticipantSubmit}
            onNext={() => setStep(steps.method)}
          />
        )}
        {activeTab === tabs.home && step === steps.method && (
          <MethodScreen selected={settlementMode} onSelect={setSettlementMode} onNext={() => chooseMethod(settlementMode)} />
        )}
        {activeTab === tabs.home && step === steps.exempt && (
          <ExemptScreen amount={effectiveAmount} people={participants.length} splitAmount={splitAmount} onNext={() => setStep(steps.roulette)} />
        )}
        {activeTab === tabs.home && step === steps.roulette && (
          <RouletteScreen amount={effectiveAmount} participants={participants} onSpin={spinRoulette} />
        )}
        {activeTab === tabs.home && step === steps.rouletteResult && (
          <RouletteResultScreen amount={effectiveAmount} splitAmount={splitAmount} winner={winner} onRetry={() => setStep(steps.roulette)} onNext={() => setStep(steps.finalResult)} />
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
        }} />

        {shareOpen && <ShareSheet amount={effectiveAmount} participants={participants} splitAmount={splitAmount} onClose={() => setShareOpen(false)} />}
      </section>
    </main>
  )
}

function TopBar({ title, progress, onBack }) {
  return (
    <header className="top-bar">
      <button className="icon-button" type="button" aria-label="이전 화면" onClick={onBack}>
        <Icon>arrow_back</Icon>
      </button>
      <strong>{title}</strong>
      <span className="progress-pill">{progress}</span>
    </header>
  )
}

function StartScreen({ onStart }) {
  return (
    <section className="screen start-screen" aria-labelledby="start-title">
      <div className="hero-copy">
        <h1 id="start-title">오늘 정산,<br /><span>재미있게 결정해요</span></h1>
        <p>금액과 참여자를 입력하면 각자 낼 금액을 계산해 드려요.</p>
      </div>
      <div className="hero-illustration" aria-hidden="true">
        <div className="receipt-card">
          <span className="icon-bubble"><Icon>payments</Icon></span>
          <i />
          <i />
          <strong>₩ 15,000</strong>
        </div>
        <div className="receipt-shadow" />
      </div>
      <button className="recent-card" type="button">
        <span className="icon-bubble muted"><Icon>history</Icon></span>
        <span>
          <small>최근 정산 (7월 14일)</small>
          <strong>강남역 삼겹살 모임</strong>
        </span>
        <b>84,000원</b>
      </button>
      <button className="primary-button" type="button" onClick={onStart}>
        정산 시작하기 <Icon>arrow_forward</Icon>
      </button>
    </section>
  )
}

function AmountScreen({ amount, onAddAmount, onReset, onNext }) {
  return (
    <section className="screen amount-screen" aria-labelledby="amount-title">
      <h1 id="amount-title">얼마를 나눌까요?</h1>
      <p className="subcopy">정산할 총 금액을 입력해 주세요.</p>
      <div className="amount-display" aria-live="polite">
        <strong>{formatWon(amount).replace('원', '')}</strong>
        <span>원</span>
      </div>
      <div className="quick-grid" aria-label="빠른 금액 입력">
        <button type="button" onClick={() => onAddAmount(10000)}>+1만 원</button>
        <button type="button" onClick={() => onAddAmount(50000)}>+5만 원</button>
        <button type="button" onClick={() => onAddAmount(100000)}>+10만 원</button>
        <button type="button" onClick={onReset}>초기화</button>
      </div>
      <div className="keypad" aria-hidden="true">
        {'123456789.0'.split('').map((key) => <span key={key}>{key}</span>)}
        <span><Icon>backspace</Icon></span>
      </div>
      <button className="primary-button" type="button" disabled={amount <= 0} onClick={onNext}>
        참여자 입력하기
      </button>
    </section>
  )
}

function ParticipantsScreen({ participants, newParticipant, onChangeName, onSubmit, onRemove, onNext }) {
  return (
    <section className="screen participants-screen" aria-labelledby="participants-title">
      <h1 id="participants-title">누가 함께했나요?</h1>
      <p className="subcopy">정산에 참여할 멤버들을 추가해주세요.</p>
      <form className="add-participant" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="participant-name">참여자 이름</label>
        <Icon>person_add</Icon>
        <input id="participant-name" value={newParticipant} onChange={(event) => onChangeName(event.target.value)} placeholder="이름 입력" />
        <button type="submit" aria-label="참여자 추가"><Icon>add</Icon></button>
      </form>
      <div className="section-title">
        <span>참여자 목록</span>
        <strong>총 {participants.length}명</strong>
        <button type="button">전체 삭제</button>
      </div>
      <ul className="member-list">
        {participants.map((participant) => (
          <li key={participant}>
            <span className="avatar">{participant.slice(0, 1)}</span>
            <strong>{participant}</strong>
            <button type="button" aria-label={`${participant} 삭제`} onClick={() => onRemove(participant)}><Icon>close</Icon></button>
          </li>
        ))}
      </ul>
      <div className="tip-card"><Icon>lightbulb</Icon> 자주 함께하는 친구들을 '즐겨찾기'에서 불러올 수 있습니다.</div>
      <button className="primary-button" type="button" onClick={onNext}>정산 방식 고르기 <Icon>chevron_right</Icon></button>
    </section>
  )
}

function MethodScreen({ selected, onSelect, onNext }) {
  return (
    <section className="screen method-screen" aria-labelledby="method-title">
      <h1 id="method-title">어떻게 나눌까요?</h1>
      <p className="subcopy">원하시는 정산 방식을 선택해 주세요.</p>
      <div className="method-list">
        {settlementModes.map((mode) => (
          <button className={`method-card ${selected === mode.id ? 'selected' : ''}`} key={mode.id} type="button" onClick={() => onSelect(mode.id)}>
            <span className="icon-bubble"><Icon>{mode.icon}</Icon></span>
            <span>
              <strong>{mode.title}</strong>
              <small>{mode.description}</small>
            </span>
            <Icon>{selected === mode.id ? 'check_circle' : 'circle'}</Icon>
          </button>
        ))}
      </div>
      <div className="info-card"><Icon>info</Icon> 선택한 방식에 따라 정산 결과가 자동으로 계산되어 전송됩니다.</div>
      <button className="primary-button" type="button" onClick={onNext}>{selected === 'exempt' ? '게임 선택하기' : '결과 확인하기'} <Icon>arrow_forward</Icon></button>
    </section>
  )
}

function ExemptScreen({ amount, people, splitAmount, onNext }) {
  return (
    <section className="screen exempt-screen" aria-labelledby="exempt-title">
      <h1 id="exempt-title">면제 정산을 설정해 주세요</h1>
      <p className="subcopy">한 명을 무작위로 선택하고, 나머지 인원이 금액을 나눠 냅니다.</p>
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
      <button className="primary-button" type="button" onClick={onNext}><Icon>play_arrow</Icon> 게임 선택하기</button>
    </section>
  )
}

function RouletteScreen({ amount, participants, onSpin }) {
  return (
    <section className="screen roulette-screen" aria-labelledby="roulette-title">
      <h1 id="roulette-title">오늘의 정산 결과는?</h1>
      <p className="subcopy">버튼을 눌러 결과를 확인해 보세요.</p>
      <div className="roulette-wheel" aria-label={`${participants.join(', ')} 룰렛`}>
        {participants.map((participant, index) => (
          <span key={participant} style={{ '--slot': index }}>{participant}</span>
        ))}
      </div>
      <div className="amount-chip">총 결제 금액 {formatWon(amount)}</div>
      <div className="roulette-members">
        {participants.map((participant) => <span key={participant}>{participant.slice(0, 1)}</span>)}
      </div>
      <button className="primary-button" type="button" onClick={onSpin}><Icon>refresh</Icon> 룰렛 돌리기</button>
    </section>
  )
}

function RouletteResultScreen({ amount, splitAmount, winner, onRetry, onNext }) {
  return (
    <section className="screen roulette-result-screen" aria-labelledby="roulette-result-title">
      <span className="result-kicker">면제 확정</span>
      <h1 id="roulette-result-title">{winner} 님이 면제됐어요</h1>
      <p className="subcopy">나머지 세 명이 {formatWon(splitAmount)}씩 나눠 내요.</p>
      <div className="winner-orb">{winner.slice(0, 1)}</div>
      <div className="result-stats">
        <div><small>결제 총액</small><strong>{formatWon(amount)}</strong><Icon>receipt_long</Icon></div>
        <div><small>면제자</small><strong>{winner}</strong><Icon>person</Icon></div>
        <div><small>1인당 금액</small><strong>{formatWon(splitAmount)}</strong></div>
      </div>
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onRetry}><Icon>refresh</Icon> 다시 뽑기</button>
        <button className="primary-button" type="button" onClick={onNext}>금액 확인하기</button>
      </div>
    </section>
  )
}

function FinalResultScreen({ amount, participants, splitAmount, winner, onRestart, onShare }) {
  return (
    <section className="screen final-screen" aria-labelledby="final-title">
      <div className="success-icon"><Icon>check_circle</Icon></div>
      <h1 id="final-title">정산이 완료됐어요</h1>
      <p className="subcopy">총 정산 금액</p>
      <strong className="big-amount">{formatWon(amount)}</strong>
      <span className="mode-badge"><Icon>casino</Icon> 한 명 면제 방식 적용</span>
      <h2>참여자별 금액</h2>
      <ul className="result-list">
        {participants.map((participant) => (
          <li className={participant === winner ? 'exempted' : ''} key={participant}>
            <span className="avatar">{participant.slice(0, 1)}</span>
            <span><strong>{participant}</strong><small>{participant === winner ? '면제 (0원)' : formatWon(splitAmount)}</small></span>
            <button type="button" aria-label={`${participant} 금액 수정`}><Icon>edit</Icon></button>
          </li>
        ))}
      </ul>
      <div className="celebration-card"><Icon>celebration</Icon> 운 좋게 {winner} 님이 면제자로 선정되었어요! 남은 인원이 각 {formatWon(splitAmount)}씩 부담합니다.</div>
      <div className="button-row">
        <button className="secondary-button" type="button"><Icon>image</Icon> 이미지로 저장</button>
        <button className="secondary-button" type="button" onClick={onRestart}><Icon>refresh</Icon> 새로운 정산</button>
      </div>
      <button className="primary-button" type="button" onClick={onShare}><Icon>share</Icon> 결과 공유하기</button>
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
        <div className="filter-row">
          {['전체', '보낸 정산', '받을 정산'].map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" onClick={() => onFilter(item)}>{item}</button>)}
        </div>
        <div className="history-list">
          {historyItems.map((item) => (
            <button className="history-item" key={item.id} type="button" onClick={onOpenDetail}>
              <span className="icon-bubble"><Icon>{item.icon}</Icon></span>
              <span>
                <small>{item.date}</small>
                <strong>{formatWon(item.amount)}</strong>
              </span>
              <span>
                <em>{item.badge}</em>
                <small>{item.people}명 참여</small>
              </span>
            </button>
          ))}
        </div>
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
        <p className="subcopy">7월 14일 정산</p>
        <h1 id="detail-title">삼겹살 회식 정산</h1>
        <p className="subcopy">어제 저녁 즐거웠던 모임 기록</p>
        <div className="summary-banner"><span>총 결제 금액</span><strong>{formatWon(amount)}</strong><Icon>auto_awesome</Icon></div>
        <div className="detail-meta"><span><Icon>groups</Icon> 참여자 총 4명</span><span>방식 한 명 면제</span></div>
        <ul className="result-list">
          {['민수', '지훈', '수진', winner].map((participant) => (
            <li className={participant === winner ? 'exempted' : ''} key={participant}>
              <span className="avatar">{participant.slice(0, 1)}</span>
              <span><strong>{participant}</strong><small>{participant === winner ? '면제 당첨!' : participant === '지훈' ? '입금 대기' : '입금 완료'}</small></span>
              <b>{participant === winner ? '0원' : formatWon(splitAmount)}</b>
            </li>
          ))}
        </ul>
        <blockquote>"{winner}님의 운이 폭발했던 그 날!"<br />총 1명의 면제자가 선정되었습니다.</blockquote>
        <button className="danger-button" type="button"><Icon>delete</Icon> 정산 내역 삭제</button>
        <button className="primary-button" type="button" onClick={onShare}><Icon>share</Icon> 결과 다시 공유하기</button>
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
        <h2>일반</h2>
        <SettingsRow icon="help" title="서비스 이용 안내" />
        <SettingsRow icon="warning" title="정산 내역 전체 삭제" description="삭제된 데이터는 복구할 수 없습니다" danger />
        <h2>약관 및 지원</h2>
        <SettingsRow icon="privacy_tip" title="개인정보 처리방침" />
        <SettingsRow icon="article" title="서비스 이용약관" />
        <SettingsRow icon="mail" title="문의하기" />
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
    <button className={`settings-row ${danger ? 'danger' : ''}`} type="button">
      <span className="icon-bubble"><Icon>{icon}</Icon></span>
      <span><strong>{title}</strong>{description && <small>{description}</small>}</span>
      <Icon>chevron_right</Icon>
    </button>
  )
}

function ShareSheet({ amount, participants, splitAmount, onClose }) {
  return (
    <div className="sheet-backdrop">
      <section className="share-sheet" role="dialog" aria-modal="true" aria-label="정산 결과 공유">
        <button className="sheet-close" type="button" aria-label="공유창 닫기" onClick={onClose}><Icon>close</Icon></button>
        <h2>정산 결과 공유하기</h2>
        <div className="share-preview">
          <strong>누가낼래</strong>
          <small>2024년 5월 24일 4인 모임</small>
          <p>총 정산 금액</p>
          <b>₩{amount.toLocaleString('ko-KR')}</b>
          <span>+{Math.max(0, participants.length - 1)}</span>
        </div>
        <div className="share-members">
          <span>김철수 (본인) {formatWon(splitAmount)}</span>
          <span>이영희 {formatWon(splitAmount)}</span>
        </div>
        {[
          ['payments', '토스로 공유'],
          ['link', '링크 복사'],
          ['download', '이미지 저장'],
          ['send', '카카오톡으로 바로 보내기'],
        ].map(([icon, label]) => (
          <button className="share-action" type="button" key={label}><Icon>{icon}</Icon>{label}</button>
        ))}
      </section>
    </div>
  )
}

function BottomNav({ activeTab, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <button aria-label="정산하기" className={activeTab === tabs.home ? 'active' : ''} type="button" onClick={() => onNavigate(tabs.home)}><Icon>payments</Icon><span>정산하기</span></button>
      <button aria-label="정산 내역" className={activeTab === tabs.history ? 'active' : ''} type="button" onClick={() => onNavigate(tabs.history)}><Icon>history</Icon><span>정산 내역</span></button>
      <button aria-label="설정" className={activeTab === tabs.settings ? 'active' : ''} type="button" onClick={() => onNavigate(tabs.settings)}><Icon>settings</Icon><span>설정</span></button>
    </nav>
  )
}

export default App

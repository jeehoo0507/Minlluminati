'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Play, Square, RotateCcw, Clock, TrendingUp, Coffee, Target, Trash2, CalendarDays, ChevronRight } from 'lucide-react'
import { SUBJECTS } from '@/lib/utils'
import toast from 'react-hot-toast'

function fmt(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function fmtShort(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분 ${sec % 60}초`
}
function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const POMODORO_FOCUS = 25 * 60
const POMODORO_BREAK = 5 * 60
const LONG_BREAK = 15 * 60

interface StudySession { id: string; duration: number; subject: string | null; memo: string | null; startedAt: string }

export default function TimerPage() {
  const { data: session } = useSession()

  // ── Timer state ──
  const [running, setRunning]     = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const [mode, setMode]           = useState<'free' | 'pomodoro'>('free')
  const [pomPhase, setPomPhase]   = useState<'focus' | 'break' | 'longbreak'>('focus')
  const [pomCount, setPomCount]   = useState(0) // completed focus sessions
  const [subject, setSubject]     = useState('')
  const [memo, setMemo]           = useState('')
  const startRef                  = useRef<number | null>(null)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Stats ──
  const [todayTotal, setTodayTotal]   = useState(0)
  const [allTotal, setAllTotal]       = useState(0)
  const [daily, setDaily]             = useState<Record<string, number>>({})
  const [todaySessions, setTodaySessions] = useState<StudySession[]>([])
  const [subjectMap, setSubjectMap]   = useState<Record<string, number>>({})

  // ── Goal & D-Day ──
  const [goalHours, setGoalHours] = useState<number>(() => {
    try { return Number(localStorage.getItem('studyGoalHours') ?? '3') || 3 } catch { return 3 }
  })
  const [dday, setDday]       = useState<string>(() => { try { return localStorage.getItem('studyDday') ?? '' } catch { return '' } })
  const [ddayLabel, setDdayLabel] = useState<string>(() => { try { return localStorage.getItem('studyDdayLabel') ?? '수능' } catch { return '수능' } })
  const [editGoal, setEditGoal]   = useState(false)
  const [editDday, setEditDday]   = useState(false)

  // Pomodoro 단계별 총 시간
  const pomTotal = pomPhase === 'focus' ? POMODORO_FOCUS : pomPhase === 'break' ? POMODORO_BREAK : LONG_BREAK

  const loadStats = useCallback(async () => {
    if (!session?.user) return
    const res = await fetch('/api/study')
    if (res.ok) {
      const d = await res.json()
      setTodayTotal(d.todayTotal)
      setAllTotal(d.allTotal)
      setDaily(d.daily)
      setTodaySessions(d.todaySessions ?? [])
      setSubjectMap(d.subjectMap ?? {})
    }
  }, [session?.user])

  // Restore localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studyTimerStart')
      if (stored) {
        const start = parseInt(stored, 10)
        if (!isNaN(start) && start > 0 && start <= Date.now()) {
          startRef.current = start
          setRunning(true)
          setElapsed(Math.floor((Date.now() - start) / 1000))
        } else {
          localStorage.removeItem('studyTimerStart')
        }
      }
      const storedSubject = localStorage.getItem('studyTimerSubject') ?? ''
      setSubject(storedSubject)
    } catch {}
    loadStats()
  }, [session, loadStats])

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          const e = Math.floor((Date.now() - startRef.current) / 1000)
          setElapsed(e)
          // 포모도로: 단계 완료 체크
          if (mode === 'pomodoro' && e >= pomTotal) {
            if (pomPhase === 'focus') {
              const nextCount = pomCount + 1
              setPomCount(nextCount)
              const nextPhase = nextCount % 4 === 0 ? 'longbreak' : 'break'
              setPomPhase(nextPhase)
              toast.success(nextPhase === 'longbreak' ? '🎉 긴 휴식 시간! (15분)' : '☕ 휴식 시간! (5분)', { duration: 4000 })
            } else {
              setPomPhase('focus')
              toast.success('💪 집중 시작!', { duration: 3000 })
            }
            // 단계 리셋
            const now = Date.now()
            startRef.current = now
            localStorage.setItem('studyTimerStart', String(now))
            setElapsed(0)
          }
        }
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, pomPhase, pomTotal, pomCount])

  async function start() {
    const now = Date.now()
    startRef.current = now
    localStorage.setItem('studyTimerStart', String(now))
    localStorage.setItem('studyTimerSubject', subject)
    setRunning(true)
    setElapsed(0)
    if (mode === 'pomodoro') { setPomPhase('focus'); setPomCount(0) }
  }

  async function stop(save = true) {
    if (!startRef.current) return
    const duration = Math.floor((Date.now() - startRef.current) / 1000)
    const sessionStart = startRef.current
    localStorage.removeItem('studyTimerStart')
    localStorage.removeItem('studyTimerSubject')
    startRef.current = null
    setRunning(false)
    setElapsed(0)
    if (save && duration >= 10) {
      await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, subject: subject || null, memo: memo || null, startedAt: sessionStart }),
      })
      toast.success(`${fmtShort(duration)} 기록됐어요! 🎉`)
      setMemo('')
      loadStats()
    }
    if (mode === 'pomodoro') setPomPhase('focus')
  }

  async function deleteSession(id: string) {
    await fetch('/api/study', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadStats()
  }

  // ── D-Day 계산 ──
  const ddayDiff = dday ? Math.ceil((new Date(dday).getTime() - Date.now()) / 86400000) : null

  // ── Goal 진행률 ──
  const goalSec  = goalHours * 3600
  const todayWithRunning = todayTotal + (running ? elapsed : 0)
  const goalPct  = Math.min(todayWithRunning / goalSec, 1)

  // ── 원형 SVG ──
  const R = 80, C = 2 * Math.PI * R
  const displayTime = mode === 'pomodoro' ? Math.max(pomTotal - elapsed, 0) : elapsed
  const ringPct = mode === 'pomodoro' ? (pomTotal - Math.min(elapsed, pomTotal)) / pomTotal : Math.min(elapsed / 7200, 1)

  // ── 14일 차트 ──
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    return { date: key, sec: daily[key] ?? 0 }
  })
  const maxSec = Math.max(...last14.map((d) => d.sec), 1)

  const subjectEntries = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const totalSubjectSec = subjectEntries.reduce((s, [, v]) => s + v, 0) || 1

  if (!session?.user) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <Clock size={40} className="text-muted mx-auto mb-4" />
      <p className="text-text-secondary">로그인이 필요합니다</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Clock size={20} className="text-accent" /> 공부 타이머
        </h1>
        {/* D-Day */}
        {ddayDiff !== null ? (
          <button onClick={() => setEditDday(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm hover:bg-surface-2 transition-colors">
            <CalendarDays size={13} className="text-accent" />
            <span className="font-semibold text-accent">{ddayLabel}</span>
            <span className="text-text-secondary">{ddayDiff === 0 ? 'D-Day!' : ddayDiff > 0 ? `D-${ddayDiff}` : `D+${Math.abs(ddayDiff)}`}</span>
          </button>
        ) : (
          <button onClick={() => setEditDday(true)} className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1">
            <CalendarDays size={12} /> D-Day 설정
          </button>
        )}
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex gap-2 bg-surface border border-border rounded-xl p-1">
        {(['free', 'pomodoro'] as const).map((m) => (
          <button key={m} onClick={() => { if (!running) setMode(m) }}
            disabled={running}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            {m === 'free' ? <><Clock size={13} /> 자유</>  : <><Coffee size={13} /> 포모도로</>}
          </button>
        ))}
      </div>

      {/* ── Main timer card ── */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        {/* Circular ring + time */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <svg width="200" height="200" className="-rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-border)" strokeWidth="8" />
              <circle cx="100" cy="100" r={R} fill="none"
                stroke={mode === 'pomodoro' ? (pomPhase === 'focus' ? '#3b82f6' : '#10b981') : '#3b82f6'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - ringPct)}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-mono font-bold tracking-wider ${running ? 'text-accent' : 'text-text-primary'}`}>
                {fmt(displayTime)}
              </span>
              {mode === 'pomodoro' && (
                <span className={`text-xs mt-1 font-medium ${pomPhase === 'focus' ? 'text-accent' : 'text-emerald-500'}`}>
                  {pomPhase === 'focus' ? `🎯 집중 #${pomCount + 1}` : pomPhase === 'break' ? '☕ 휴식' : '🛌 긴 휴식'}
                </span>
              )}
              {mode === 'pomodoro' && pomCount > 0 && (
                <span className="text-[10px] text-muted mt-0.5">{pomCount}세션 완료</span>
              )}
            </div>
          </div>

          {/* 과목 선택 */}
          <div className="w-full flex gap-2">
            <select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={running}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-60">
              <option value="">과목 선택 (선택)</option>
              {Object.entries(SUBJECTS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 시작/종료 버튼 */}
          <div className="flex gap-2 w-full">
            {!running ? (
              <button onClick={start}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-dim transition-colors">
                <Play size={16} className="fill-white" /> 시작
              </button>
            ) : (
              <>
                <button onClick={() => stop(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm">
                  <Square size={15} className="fill-white" /> 종료 &amp; 저장
                </button>
                <button onClick={() => stop(false)}
                  className="px-3 py-3 rounded-xl border border-border text-text-secondary hover:bg-surface-2 transition-colors" title="저장 없이 종료">
                  <RotateCcw size={15} />
                </button>
              </>
            )}
          </div>
          {running && <p className="text-[11px] text-muted text-center">탭을 닫아도 타이머가 유지됩니다</p>}
        </div>
      </div>

      {/* ── 오늘 목표 ── */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <Target size={14} className="text-accent" />
            오늘 목표
          </div>
          <button onClick={() => setEditGoal(!editGoal)} className="text-xs text-muted hover:text-accent transition-colors">
            {editGoal ? '완료' : '수정'}
          </button>
        </div>
        {editGoal ? (
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={24} value={goalHours}
              onChange={(e) => { const v = Number(e.target.value); setGoalHours(v); try { localStorage.setItem('studyGoalHours', String(v)) } catch {} }}
              className="w-20 px-2 py-1 bg-background border border-border rounded text-sm text-center focus:outline-none focus:border-accent" />
            <span className="text-sm text-text-secondary">시간</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{fmtShort(todayWithRunning)}</span>
              <span>{goalHours}시간 목표</span>
            </div>
            <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${goalPct * 100}%`, background: goalPct >= 1 ? '#10b981' : undefined }} />
            </div>
            {goalPct >= 1 && <p className="text-xs text-emerald-500 font-medium">🎉 오늘 목표 달성!</p>}
          </>
        )}
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">오늘 공부</p>
          <p className="text-xl font-bold text-text-primary font-mono">{fmt(todayWithRunning)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">누적 공부</p>
          <p className="text-xl font-bold text-accent font-mono">{fmt(allTotal + (running ? elapsed : 0))}</p>
        </div>
      </div>

      {/* ── 오늘 세션 히스토리 ── */}
      {todaySessions.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Clock size={13} className="text-accent" /> 오늘 기록
          </p>
          <div className="space-y-1.5">
            {todaySessions.map((s) => {
              const subj = s.subject ? SUBJECTS[s.subject as keyof typeof SUBJECTS] : null
              return (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-2 transition-colors group">
                  <span className="text-xs text-muted w-10 shrink-0">{fmtTime(new Date(s.startedAt))}</span>
                  <span className="flex-1 text-xs text-text-primary font-mono">{fmt(s.duration)}</span>
                  {subj && <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">{subj.short}</span>}
                  {s.memo && <span className="text-xs text-muted truncate max-w-[80px]">{s.memo}</span>}
                  <button onClick={() => deleteSession(s.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all ml-auto">
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 14일 바 차트 ── */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <TrendingUp size={14} className="text-accent" /> 최근 14일
        </div>
        <div className="flex items-end gap-1 h-20">
          {last14.map(({ date, sec }) => {
            const today = date === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className={`w-full rounded-t transition-all ${today ? 'bg-accent' : 'bg-accent/50'}`}
                  style={{ height: `${Math.max(sec / maxSec * 72, sec > 0 ? 4 : 0)}px` }} />
                <span className={`text-[8px] ${today ? 'text-accent font-bold' : 'text-muted'}`}>{date.slice(8)}</span>
                {sec > 0 && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-surface-2 border border-border text-[9px] text-text-primary px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    {fmtShort(sec)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 과목별 누적 ── */}
      {subjectEntries.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">과목별 누적 시간</p>
          <div className="space-y-2">
            {subjectEntries.map(([key, sec]) => {
              const subj = SUBJECTS[key as keyof typeof SUBJECTS]
              const pct = sec / totalSubjectSec
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{subj ? subj.label : key}</span>
                    <span className="text-muted font-mono">{fmtShort(sec)}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── D-Day 편집 모달 ── */}
      {editDday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditDday(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 w-80 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-text-primary flex items-center gap-2"><CalendarDays size={16} className="text-accent" /> D-Day 설정</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">이름</label>
                <input value={ddayLabel} onChange={(e) => setDdayLabel(e.target.value)}
                  placeholder="수능, 기말고사 등"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">날짜</label>
                <input type="date" value={dday} onChange={(e) => setDday(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setDday(''); setDdayLabel('수능'); try { localStorage.removeItem('studyDday') } catch {} setEditDday(false) }}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-2 transition-colors">제거</button>
              <button onClick={() => {
                try { localStorage.setItem('studyDday', dday); localStorage.setItem('studyDdayLabel', ddayLabel) } catch {}
                setEditDday(false)
              }} className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

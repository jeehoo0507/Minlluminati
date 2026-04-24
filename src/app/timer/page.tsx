'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Play, Square, Clock, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

function fmt(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimerPage() {
  const { data: session } = useSession()
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const [todayTotal, setTodayTotal] = useState(0)
  const [allTotal, setAllTotal] = useState(0)
  const [daily, setDaily] = useState<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number | null>(null)

  // Load stats
  async function loadStats() {
    if (!session?.user) return
    const res = await fetch('/api/study')
    if (res.ok) {
      const d = await res.json()
      setTodayTotal(d.todayTotal)
      setAllTotal(d.allTotal)
      setDaily(d.daily)
    }
  }

  useEffect(() => {
    // Restore timer state from localStorage
    const stored = localStorage.getItem('studyTimerStart')
    if (stored) {
      const start = parseInt(stored)
      startRef.current = start
      setRunning(true)
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }
    loadStats()
  }, [session])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        }
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function start() {
    const now = Date.now()
    startRef.current = now
    localStorage.setItem('studyTimerStart', String(now))
    setRunning(true)
    setElapsed(0)
  }

  async function stop() {
    if (!startRef.current) return
    const duration = Math.floor((Date.now() - startRef.current) / 1000)
    localStorage.removeItem('studyTimerStart')
    startRef.current = null
    setRunning(false)
    setElapsed(0)
    if (duration >= 10) {
      await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      })
      toast.success(`${fmt(duration)} 저장됐어요`)
      loadStats()
    }
  }

  // Last 14 days for mini chart
  const last14: { date: string; sec: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    last14.push({ date: key, sec: daily[key] ?? 0 })
  }
  const maxSec = Math.max(...last14.map((d) => d.sec), 1)

  if (!session?.user) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-text-secondary">로그인이 필요합니다</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
        <Clock size={20} className="text-accent" /> 공부 타이머
      </h1>

      {/* Timer display */}
      <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-6">
        <div className={`text-6xl font-mono font-bold tracking-wider transition-colors ${running ? 'text-accent' : 'text-text-primary'}`}>
          {fmt(elapsed)}
        </div>
        <div className="flex items-center justify-center gap-3">
          {!running ? (
            <button onClick={start} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-dim transition-colors text-sm">
              <Play size={16} className="fill-white" /> 시작
            </button>
          ) : (
            <button onClick={stop} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm">
              <Square size={16} className="fill-white" /> 종료 &amp; 저장
            </button>
          )}
        </div>
        {running && <p className="text-xs text-muted">탭을 닫아도 타이머가 유지됩니다</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">오늘 공부 시간</p>
          <p className="text-2xl font-bold text-text-primary font-mono">{fmt(todayTotal + (running ? elapsed : 0))}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">누적 공부 시간</p>
          <p className="text-2xl font-bold text-accent font-mono">{fmt(allTotal + (running ? elapsed : 0))}</p>
        </div>
      </div>

      {/* 14-day bar chart */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <TrendingUp size={14} className="text-accent" /> 최근 14일
        </div>
        <div className="flex items-end gap-1 h-20">
          {last14.map(({ date, sec }) => (
            <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t bg-accent/70 transition-all"
                style={{ height: `${Math.max(sec / maxSec * 72, sec > 0 ? 4 : 0)}px` }}
                title={`${date}: ${fmt(sec)}`}
              />
              <span className="text-[8px] text-muted">{date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

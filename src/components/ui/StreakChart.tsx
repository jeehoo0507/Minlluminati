'use client'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'

interface Props {
  streakMap: Record<string, number>
  year: number
  streak: number
  onYearChange: (y: number) => void
}

export function StreakChart({ streakMap, year, streak, onYearChange }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const currentYear = today.getFullYear()

  // Build weeks for the full year (Jan 1 to Dec 31)
  const weeks: { date: string; count: number }[][] = []
  const yearStart = new Date(`${year}-01-01T00:00:00`)
  // Start from the Sunday on or before Jan 1
  const start = new Date(yearStart)
  start.setDate(start.getDate() - start.getDay())

  const yearEnd = new Date(`${year}-12-31T00:00:00`)

  let cur = new Date(start)
  while (cur <= yearEnd) {
    const week: { date: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = cur.toLocaleDateString('sv-SE')
      const inYear = cur.getFullYear() === year
      const isFuture = cur > today
      week.push({
        date: key,
        count: !inYear ? -2 : isFuture ? -1 : (streakMap[key] ?? 0),
      })
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  function getColor(count: number) {
    if (count === -2) return 'bg-transparent'
    if (count === -1) return 'bg-transparent'
    if (count === 0) return 'bg-border'
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900'
    if (count === 2) return 'bg-emerald-400 dark:bg-emerald-700'
    if (count <= 4) return 'bg-emerald-500 dark:bg-emerald-500'
    return 'bg-emerald-700 dark:bg-emerald-300'
  }

  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const days = ['일','월','화','수','목','금','토']
  const totalContribs = Object.values(streakMap).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-2">
          <button onClick={() => onYearChange(year - 1)} className="p-0.5 rounded hover:text-text-primary transition-colors"><ChevronLeft size={14} /></button>
          <span className="font-semibold text-text-secondary">{year}년</span>
          <button onClick={() => onYearChange(year + 1)} disabled={year >= currentYear} className="p-0.5 rounded hover:text-text-primary transition-colors disabled:opacity-30"><ChevronRight size={14} /></button>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && year === currentYear && (
            <span className="flex items-center gap-1 text-orange-500 font-semibold">
              <Flame size={12} className="fill-orange-500" /> {streak}일 연속
            </span>
          )}
          <span>{totalContribs}개 기여</span>
        </div>
      </div>
      <div className="overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-[3px] min-w-max">
          <div className="flex flex-col gap-[3px] mr-0.5 pt-5">
            {days.map((d, i) => (
              <div key={d} className={`h-[10px] text-[8px] text-muted leading-[10px] ${i % 2 === 0 ? '' : 'opacity-0'}`}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              <div className="h-4 text-[8px] text-muted leading-4 truncate w-[10px]">
                {week[0] && new Date(week[0].date + 'T00:00:00').getDate() <= 7 && new Date(week[0].date + 'T00:00:00').getFullYear() === year
                  ? months[new Date(week[0].date + 'T00:00:00').getMonth()].slice(0, 2)
                  : ''}
              </div>
              {week.map((day) => (
                <div
                  key={day.date}
                  title={day.count >= 0 ? `${day.date}: ${day.count}개` : ''}
                  className={`w-[10px] h-[10px] rounded-sm ${getColor(day.count)} transition-colors ${day.date === todayStr ? 'ring-1 ring-accent ring-offset-1 ring-offset-background' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

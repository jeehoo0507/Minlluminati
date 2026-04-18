'use client'

interface Props {
  streakMap: Record<string, number>
}

export function StreakChart({ streakMap }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build 52 weeks of days (364 days + today's week)
  const weeks: { date: string; count: number }[][] = []
  // Start from the Sunday 52 weeks ago
  const start = new Date(today)
  start.setDate(start.getDate() - 363 - start.getDay())

  let cur = new Date(start)
  while (cur <= today) {
    const week: { date: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = cur.toISOString().slice(0, 10)
      const isFuture = cur > today
      week.push({ date: key, count: isFuture ? -1 : (streakMap[key] ?? 0) })
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  function getColor(count: number) {
    if (count < 0) return 'bg-transparent'
    if (count === 0) return 'bg-border dark:bg-surface-2'
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
        <span>최근 1년 활동</span>
        <span>{totalContribs}개 기여</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 pt-5">
            {days.map((d, i) => (
              <div key={d} className={`h-3 text-[9px] text-muted leading-3 ${i % 2 === 0 ? '' : 'opacity-0'}`}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {/* Month label on first day of month */}
              <div className="h-4 text-[9px] text-muted leading-4 truncate w-3">
                {week[0] && new Date(week[0].date + 'T00:00:00').getDate() <= 7
                  ? months[new Date(week[0].date + 'T00:00:00').getMonth()].slice(0, 2)
                  : ''}
              </div>
              {week.map((day) => (
                <div
                  key={day.date}
                  title={day.count >= 0 ? `${day.date}: ${day.count}개` : ''}
                  className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

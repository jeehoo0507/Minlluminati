/**
 * 인메모리 Rate Limiter (Node.js API 라우트 전용)
 * — 단일 프로세스 기준. 다중 인스턴스는 Redis 등으로 교체 필요.
 */

interface Entry {
  count: number
  reset: number
}

const store = new Map<string, Entry>()

// 오래된 항목 주기적 정리 (메모리 누수 방지)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((entry, key) => {
      if (entry.reset < now) store.delete(key)
    })
  }, 60_000).unref?.()
}

/**
 * Rate limit 검사.
 * @returns `true` → 허용, `false` → 차단
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.reset < now) {
    store.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

/** 남은 요청 횟수 반환 (rate limit 상태 확인용) */
export function getRemainingRequests(
  key: string,
  limit: number
): number {
  const entry = store.get(key)
  if (!entry || entry.reset < Date.now()) return limit
  return Math.max(0, limit - entry.count)
}

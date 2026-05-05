/**
 * AI 동시 접속 제한 (GPU 보호)
 * 단일 Node.js 프로세스 내에서 in-memory로 관리
 */

const MAX_CONCURRENT = parseInt(process.env.AI_MAX_CONCURRENT ?? '2', 10)

let activeCount = 0

export function getActiveCount() {
  return activeCount
}

export function getMaxConcurrent() {
  return MAX_CONCURRENT
}

/** 슬롯 확보 시도. 성공하면 true, 꽉 찼으면 false */
export function tryAcquireSlot(): boolean {
  if (activeCount >= MAX_CONCURRENT) return false
  activeCount++
  return true
}

/** 슬롯 반환 */
export function releaseSlot(): void {
  if (activeCount > 0) activeCount--
}

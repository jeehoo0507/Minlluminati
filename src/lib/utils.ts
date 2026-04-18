import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko })
}

export const SUBJECTS = {
  MATH1_MID:   { label: '공통수학1 중간', short: '수1-중', category: 'math' },
  MATH1_FINAL: { label: '공통수학1 기말', short: '수1-기', category: 'math' },
  MATH2_MID:   { label: '공통수학2 중간', short: '수2-중', category: 'math' },
  MATH2_FINAL: { label: '공통수학2 기말', short: '수2-기', category: 'math' },
  FREE:        { label: '자유 문제', short: '자유', category: 'free' },
  PROOF:       { label: '증명', short: '증명', category: 'free' },
  TIPS:        { label: '날먹 기술', short: '날먹', category: 'free' },
  PHYSICS:     { label: '물리', short: '물리', category: 'science' },
  CHEMISTRY:   { label: '화학', short: '화학', category: 'science' },
  CS:          { label: '정보/코딩', short: '정보', category: 'science' },
  EARTH:       { label: '지구과학', short: '지구', category: 'science' },
  QUESTION:    { label: '질문', short: '질문', category: 'community' },
  BOARD:       { label: '자유게시판', short: '자유판', category: 'community' },
} as const

export type SubjectKey = keyof typeof SUBJECTS

export const UNITS: Record<string, string[]> = {
  MATH1_MID: ['다항식의 연산', '인수분해', '항등식과 미정계수법', '나머지 정리', '실수', '복소수', '일차-이차 방정식', '이차방정식의 근과 계수와의 관계', '이차방정식과 이차함수'],
  MATH1_FINAL: ['집합', '명제', '함수', '유리식과 무리식'],
  MATH2_MID: ['지수와 로그', '지수함수와 로그함수', '삼각함수'],
  MATH2_FINAL: ['수열', '수학적 귀납법', '극한과 연속'],
}

export function parseJsonSafe<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

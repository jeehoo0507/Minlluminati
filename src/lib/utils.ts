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
  MATH1:     { label: '공통수학 1', short: '수1', category: 'math' },
  MATH2:     { label: '공통수학 2', short: '수2', category: 'math' },
  MATH:      { label: '수학', short: '수학', category: 'math' },
  FREE:      { label: '자유 문제', short: '자유', category: 'free' },
  PROOF:     { label: '증명', short: '증명', category: 'free' },
  TIPS:      { label: '날먹 기술', short: '날먹', category: 'free' },
  PHYSICS:   { label: '물리', short: '물리', category: 'science' },
  CHEMISTRY: { label: '화학', short: '화학', category: 'science' },
  CS:        { label: '정보', short: '정보', category: 'science' },
  EARTH:     { label: '지구', short: '지구', category: 'science' },
  BIOLOGY:   { label: '생명', short: '생명', category: 'science' },
  QUESTION:  { label: '질문', short: '질문', category: 'community' },
  BOARD:     { label: '자유게시판', short: '자유판', category: 'community' },
} as const

export type SubjectKey = keyof typeof SUBJECTS

export const PROBLEM_SUBJECTS: SubjectKey[] = ['MATH1', 'MATH2', 'MATH', 'PHYSICS', 'CHEMISTRY', 'CS', 'EARTH', 'BIOLOGY']

export const UNITS: Record<string, string[]> = {
  MATH1: [
    '다항식의 연산', '인수분해', '항등식과 미정계수법', '나머지 정리',
    '실수', '복소수', '일차-이차 방정식', '이차방정식의 근과 계수와의 관계', '이차방정식과 이차함수',
    '최대와 최소', '삼차방정식과 사차방정식', '연립방정식',
    '일차부등식과 연립일차부등식', '이차부등식과 연립이차부등식',
    '경우의 수', '순열과 조합', '행렬의 뜻', '행렬의 연산',
  ],
  MATH2: [
    '평면좌표', '직선의 방정식', '원의 방정식', '도형의 이동',
    '집합', '집합의 연산법칙', '명제와 조건', '명제의 증명',
    '함수', '합성함수와 역함수', '다항함수의 그래프', '유리함수의 그래프', '무리함수의 그래프',
  ],
}

export function parseJsonSafe<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

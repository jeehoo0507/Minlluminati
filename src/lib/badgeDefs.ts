export interface BadgeDef {
  key: string
  name: string
  description: string
  title?: string   // 칭호 text (null → no title)
  isHidden: boolean
  sortOrder: number
}

export const BADGE_DEFS: BadgeDef[] = [
  // ── 문제 풀기 ──────────────────────────────────────────────────
  { key: 'solve_1',    name: '처음 문제 풀기',  description: '처음으로 문제를 풀었습니다',      isHidden: false, sortOrder: 100 },
  { key: 'solve_50',   name: '50문제 풀기',     description: '문제를 50개 풀었습니다',          isHidden: false, sortOrder: 101 },
  { key: 'solve_100',  name: '100문제 풀기',    description: '문제를 100개 풀었습니다',         isHidden: false, sortOrder: 102 },
  { key: 'solve_200',  name: '200문제 풀기',    description: '문제를 200개 풀었습니다',         isHidden: false, sortOrder: 103 },
  { key: 'solve_300',  name: '300문제 풀기',    description: '문제를 300개 풀었습니다',         isHidden: false, sortOrder: 104 },
  { key: 'solve_500',  name: '500문제 풀기',    description: '문제를 500개 풀었습니다',         isHidden: false, sortOrder: 105 },
  { key: 'solve_1000', name: '1000문제 풀기',   description: '문제를 1000개 풀었습니다', title: 'G.O.D', isHidden: false, sortOrder: 106 },

  // ── 대회 ────────────────────────────────────────────────────────
  { key: 'contest_win_1',  name: '대회 우승',      description: '대회에서 우승했습니다',                    isHidden: false, sortOrder: 200 },
  { key: 'contest_win_3',  name: '대회 우승 3회',  description: '대회에서 3번 우승했습니다',                isHidden: false, sortOrder: 201 },
  { key: 'contest_win_10', name: '대회 우승 10회', description: '대회에서 10번 우승했습니다', title: '전설', isHidden: false, sortOrder: 202 },

  // ── 스트릭 ──────────────────────────────────────────────────────
  { key: 'streak_10',  name: '스트릭 10일',  description: '10일 연속 활동했습니다',                   isHidden: false, sortOrder: 300 },
  { key: 'streak_100', name: '스트릭 100일', description: '100일 연속 활동했습니다',                  isHidden: false, sortOrder: 301 },
  { key: 'streak_200', name: '스트릭 200일', description: '200일 연속 활동했습니다', title: '의지',   isHidden: false, sortOrder: 302 },
  { key: 'streak_300', name: '스트릭 300일', description: '300일 연속 활동했습니다', title: '집념',   isHidden: false, sortOrder: 303 },
  { key: 'streak_365', name: '스트릭 1년',   description: '365일 연속 활동했습니다', title: '불꽃',   isHidden: false, sortOrder: 304 },

  // ── 문제 출제 ───────────────────────────────────────────────────
  { key: 'upload_1',   name: '문제 1회 출제',   description: '처음으로 문제를 출제했습니다',    title: '씨앗심기', isHidden: false, sortOrder: 400 },
  { key: 'upload_10',  name: '문제 10회 출제',  description: '문제를 10번 출제했습니다',        title: '제자',     isHidden: false, sortOrder: 401 },
  { key: 'upload_50',  name: '문제 50회 출제',  description: '문제를 50번 출제했습니다',                           isHidden: false, sortOrder: 402 },
  { key: 'upload_100', name: '문제 100회 출제', description: '문제를 100번 출제했습니다',       title: '장인',     isHidden: false, sortOrder: 403 },

  // ── 피드 작성 ───────────────────────────────────────────────────
  { key: 'feed_1',   name: '첫 글 작성',      description: '처음으로 피드에 글을 작성했습니다', title: '첫 목소리', isHidden: false, sortOrder: 500 },
  { key: 'feed_5',   name: '피드 5회 작성',   description: '피드에 글을 5번 작성했습니다',                         isHidden: false, sortOrder: 501 },
  { key: 'feed_10',  name: '피드 10회 작성',  description: '피드에 글을 10번 작성했습니다',                        isHidden: false, sortOrder: 502 },
  { key: 'feed_100', name: '피드 100회 작성', description: '피드에 글을 100번 작성했습니다',  title: 'DC',        isHidden: false, sortOrder: 503 },

  // ── 히든 ────────────────────────────────────────────────────────
  { key: 'hidden_gambler',     name: '도박왕',        description: '겜블러1 문제를 풀었습니다',                      title: '도박왕',       isHidden: true, sortOrder: 900 },
  { key: 'hidden_persistent',  name: '병 GOD',        description: '10번 연속 실패 후 같은 문제를 해결했습니다',     title: '병 GOD',       isHidden: true, sortOrder: 901 },
  { key: 'hidden_stalker',     name: '변태',          description: '다른 유저 프로필을 50회 이상 확인했습니다',      title: '변태',         isHidden: true, sortOrder: 902 },
  { key: 'hidden_image_maker', name: '이미지 메이커', description: '프로필 사진을 변경했습니다',                    title: '이미지 메이커', isHidden: true, sortOrder: 903 },
  { key: 'hidden_first_ruby',  name: 'first ruby',    description: '플랫폼 최초로 루비를 달성했습니다',             title: 'first ruby',   isHidden: true, sortOrder: 904 },
  { key: 'hidden_popular',          name: '주딱',        description: '피드 글에서 하트 10개 이상을 받았습니다',                      title: '주딱',        isHidden: true, sortOrder: 905 },
  { key: 'hidden_linear_algebra',   name: '선형대수학자', description: 'Linear algebra 문제집의 모든 문제를 해결했습니다.', title: '선형대수학자', isHidden: true, sortOrder: 906 },
]

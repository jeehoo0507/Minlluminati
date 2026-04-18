import Link from 'next/link'
import { SUBJECTS, type SubjectKey } from '@/lib/utils'
import { BookOpen, Lightbulb, FlaskConical, MessageSquare } from 'lucide-react'

const GROUPS = [
  { label: '수학', icon: BookOpen, color: 'text-blue-700', keys: ['MATH1_MID', 'MATH1_FINAL', 'MATH2_MID', 'MATH2_FINAL'] as SubjectKey[] },
  { label: '자유/기타', icon: Lightbulb, color: 'text-accent', keys: ['FREE', 'PROOF', 'TIPS'] as SubjectKey[] },
  { label: '과학/정보', icon: FlaskConical, color: 'text-violet-700', keys: ['PHYSICS', 'CHEMISTRY', 'CS', 'EARTH'] as SubjectKey[] },
  { label: '커뮤니티', icon: MessageSquare, color: 'text-amber-700', keys: ['QUESTION', 'BOARD'] as SubjectKey[] },
]

export default function SubjectsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">과목별 보기</h1>
        <p className="text-sm text-text-secondary mt-1">과목을 선택해서 해당 문제들을 확인하세요</p>
      </div>
      {GROUPS.map(({ label, icon: Icon, color, keys }) => (
        <section key={label}>
          <h2 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${color}`}>
            <Icon size={15} />
            {label}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {keys.map((key) => (
              <Link
                key={key}
                href={`/subjects/${key.toLowerCase()}`}
                className="flex flex-col gap-1 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all group"
              >
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {SUBJECTS[key].label}
                </span>
                <span className="text-xs text-muted">{SUBJECTS[key].short}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

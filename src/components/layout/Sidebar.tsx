'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, SUBJECTS, type SubjectKey } from '@/lib/utils'
import { BookOpen, Flame, HelpCircle, MessageSquare, FolderOpen, Lightbulb } from 'lucide-react'

const SUBJECT_GROUPS = [
  {
    label: '수학',
    icon: BookOpen,
    subjects: ['MATH1', 'MATH2'] as SubjectKey[],
  },
  {
    label: '자유/기타',
    icon: Lightbulb,
    subjects: ['FREE', 'PROOF', 'TIPS'] as SubjectKey[],
  },
  {
    label: '과학/정보',
    icon: FolderOpen,
    subjects: ['PHYSICS', 'CHEMISTRY', 'CS', 'EARTH'] as SubjectKey[],
  },
  {
    label: '커뮤니티',
    icon: MessageSquare,
    subjects: ['QUESTION', 'BOARD'] as SubjectKey[],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <div className="sticky top-20 space-y-1">
        <Link
          href="/feed"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/feed'
              ? 'text-accent bg-accent/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
          )}
        >
          <Flame size={15} />
          전체 피드
        </Link>

        {SUBJECT_GROUPS.map(({ label, icon: Icon, subjects }) => (
          <div key={label} className="pt-3">
            <p className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Icon size={11} />
              {label}
            </p>
            {subjects.map((key) => (
              <Link
                key={key}
                href={`/subjects/${key.toLowerCase()}`}
                className={cn(
                  'flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                  pathname === `/subjects/${key.toLowerCase()}`
                    ? 'text-accent bg-accent/10 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                )}
              >
                {SUBJECTS[key].label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}

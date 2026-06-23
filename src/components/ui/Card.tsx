import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings: Record<string, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
}

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={['bg-white rounded-xl border border-slate-200', paddings[padding], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

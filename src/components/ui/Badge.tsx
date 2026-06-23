import type { ReactNode } from 'react'

type BadgeColour =
  | 'slate' | 'emerald' | 'green' | 'teal' | 'cyan'
  | 'blue' | 'indigo' | 'purple' | 'violet'
  | 'amber' | 'yellow' | 'orange' | 'red' | 'rose'

interface BadgeProps {
  children: ReactNode
  colour?: BadgeColour
  size?: 'sm' | 'md'
  className?: string
}

const colours: Record<BadgeColour, string> = {
  slate:   'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  green:   'bg-green-50 text-green-700',
  teal:    'bg-teal-50 text-teal-700',
  cyan:    'bg-cyan-50 text-cyan-700',
  blue:    'bg-blue-50 text-blue-700',
  indigo:  'bg-indigo-50 text-indigo-700',
  purple:  'bg-purple-50 text-purple-700',
  violet:  'bg-violet-50 text-violet-700',
  amber:   'bg-amber-50 text-amber-700',
  yellow:  'bg-yellow-50 text-yellow-700',
  orange:  'bg-orange-50 text-orange-700',
  red:     'bg-red-50 text-red-700',
  rose:    'bg-rose-50 text-rose-600',
}

export default function Badge({ children, colour = 'slate', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        colours[colour],
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  )
}

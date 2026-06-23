import type { ReactNode, SelectHTMLAttributes } from 'react'

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id: string
  label?: string
  hint?: string
  error?: string
  children: ReactNode
}

export default function Select({ id, label, hint, error, className = '', children, ...props }: SelectProps) {
  const selectClasses = [
    'w-full px-3.5 py-3 text-sm text-slate-900 bg-white rounded-lg border transition-colors appearance-none',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
    error
      ? 'border-red-400 focus:ring-red-400'
      : 'border-slate-300 focus:ring-emerald-500 focus:border-transparent',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select id={id} className={selectClasses} {...props}>
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

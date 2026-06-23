import type { TextareaHTMLAttributes } from 'react'

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string
  label?: string
  hint?: string
  error?: string
}

export default function Textarea({ id, label, hint, error, className = '', rows = 4, ...props }: TextareaProps) {
  const textareaClasses = [
    'w-full px-3.5 py-3 text-sm text-slate-900 bg-white rounded-lg border transition-colors resize-y',
    'placeholder:text-slate-400',
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
      <textarea id={id} rows={rows} className={textareaClasses} {...props} />
      {error ? (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

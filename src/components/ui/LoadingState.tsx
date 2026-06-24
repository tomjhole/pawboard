interface LoadingStateProps {
  type?: 'spinner' | 'skeleton'
  message?: string
  rows?: number
}

const skeletonWidths = ['w-3/4', 'w-full', 'w-2/3', 'w-4/5', 'w-1/2', 'w-5/6']

function Spinner() {
  return (
    <svg className="animate-spin w-8 h-8" style={{ color: 'var(--brand-primary)' }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SkeletonRow({ width }: { width: string }) {
  return (
    <div className={`h-4 bg-slate-200 rounded-md animate-pulse ${width}`} />
  )
}

export default function LoadingState({ type = 'spinner', message = 'Loading…', rows = 5 }: LoadingStateProps) {
  if (type === 'skeleton') {
    return (
      <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} width={skeletonWidths[i % skeletonWidths.length]} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" aria-busy="true">
      <Spinner />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

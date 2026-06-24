import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  backHref?: string
}

export default function PageHeader({ title, description, action, backHref }: PageHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleBack() {
    if (location.key !== 'default') {
      navigate(-1)
    } else if (backHref) {
      navigate(backHref)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        {backHref && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <h2 className="text-xl font-semibold text-slate-900 truncate">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

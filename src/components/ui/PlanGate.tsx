import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

interface PlanGateProps {
  /** What the user can't do, e.g. "Adding more spaces" or "Custom species" */
  feature: string
  /** Which plan unlocks it, e.g. "PawBoard Professional" */
  requiredPlan: string
  /** True when the block is a numeric limit being hit rather than a missing feature */
  limitHit?: boolean
  className?: string
}

export default function PlanGate({ feature, requiredPlan, limitHit = false, className = '' }: PlanGateProps) {
  const headline = limitHit
    ? `You've reached the ${feature} limit on your current plan.`
    : `${feature} is not available on your current plan.`

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-900">{headline}</p>
        <p className="text-sm text-amber-700 mt-0.5">
          Upgrade to{' '}
          <span className="font-semibold">{requiredPlan}</span>
          {' '}or higher to unlock this.{' '}
          <Link to="/settings/plan" className="underline hover:text-amber-900 transition-colors">
            View plans
          </Link>
        </p>
      </div>
    </div>
  )
}

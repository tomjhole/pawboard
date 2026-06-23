import { useEffect } from 'react'
import { useBusinessContext } from '@/context/BusinessContext'

const DEFAULTS = {
  primary_colour:   '#059669',
  secondary_colour: '#0f172a',
  accent_colour:    '#f59e0b',
}

export default function ThemeApplicator() {
  const { theme } = useBusinessContext()

  useEffect(() => {
    const t = theme ?? DEFAULTS
    const root = document.documentElement
    root.style.setProperty('--brand-primary',   t.primary_colour)
    root.style.setProperty('--brand-secondary', t.secondary_colour)
    root.style.setProperty('--brand-accent',    t.accent_colour)
  }, [theme])

  return null
}

import { useState } from 'react'
import { Bug, Lightbulb, CheckCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
}

type FeedbackType = 'bug' | 'feature'

export default function FeedbackModal({ open, onClose }: Props) {
  const [type, setType]       = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function handleClose() {
    onClose()
    // Reset after animation settles
    setTimeout(() => { setSent(false); setMessage(''); setError(null); setType('bug') }, 200)
  }

  async function handleSubmit() {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { error: fnErr } = await supabase.functions.invoke('send-feedback', {
        body: { type, message: message.trim(), pageUrl: window.location.href },
      })
      if (fnErr) throw fnErr
      setSent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={sent ? 'Thanks for your feedback' : 'Send feedback'}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
          <p className="text-sm text-slate-600 max-w-xs">
            Your {type === 'bug' ? 'bug report' : 'feature request'} has been sent. We'll look into it.
          </p>
          <Button onClick={handleClose} className="mt-2">Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'bug' as FeedbackType,     label: 'Bug report',      Icon: Bug        },
              { value: 'feature' as FeedbackType, label: 'Feature request', Icon: Lightbulb  },
            ] as const).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={[
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                  type === value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {type === 'bug' ? 'What happened?' : 'What would you like to see?'}
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'Describe what you did, what you expected, and what actually happened…'
                  : 'Describe the feature and how it would help you…'
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!message.trim() || loading}>
              {loading ? 'Sending…' : 'Send feedback'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

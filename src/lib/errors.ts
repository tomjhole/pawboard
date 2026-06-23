import type { AuthError } from '@supabase/supabase-js'

export interface AppError {
  message: string
  code?: string
}

const authErrorMessages: Record<string, string> = {
  invalid_credentials:          'Incorrect email address or password.',
  email_not_confirmed:          'Please confirm your email address before signing in.',
  over_email_send_rate_limit:   'Too many sign-in attempts. Please wait a moment and try again.',
  user_already_exists:          'An account with this email address already exists.',
  weak_password:                'Please choose a stronger password.',
  expired_token:                'Your session has expired. Please sign in again.',
  user_not_found:               'No account found with this email address.',
  session_not_found:            'Your session could not be found. Please sign in again.',
  refresh_token_not_found:      'Your session has expired. Please sign in again.',
  user_banned:                  'This account has been suspended. Please contact support.',
}

export function normalizeAuthError(error: AuthError): AppError {
  const mapped = authErrorMessages[error.code ?? '']
  if (mapped) return { message: mapped, code: error.code }

  // Fall back to Supabase message, but make it user-friendly
  if (error.message.toLowerCase().includes('invalid login credentials')) {
    return { message: 'Incorrect email address or password.', code: error.code }
  }

  return { message: error.message || 'An unexpected error occurred.', code: error.code }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof Error) {
    return { message: error.message }
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return { message: String((error as { message: unknown }).message) }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  return { message: 'An unexpected error occurred.' }
}

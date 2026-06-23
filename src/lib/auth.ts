import { supabase } from './supabase'
import { normalizeAuthError } from './errors'
import type { User, Session } from '@supabase/supabase-js'
import type { AppError } from './errors'

export type AuthResult<T> = {
  data: T | null
  error: AppError | null
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { data: null, error: normalizeAuthError(error) }
  return { data: data.session, error: null }
}

export async function signOut(): Promise<{ error: AppError | null }> {
  const { error } = await supabase.auth.signOut()
  if (error) return { error: normalizeAuthError(error) }
  return { error: null }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}

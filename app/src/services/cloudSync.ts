import type { User } from '@supabase/supabase-js'
import type { AppData } from '../types/domain'
import { isSupabaseConfigured, supabase, type CloudNotebookRow } from './supabaseClient'

export type CloudSyncState = {
  configured: boolean
  user: User | null
}

function formatSupabaseError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const payload = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    return [payload.message, payload.details, payload.hint, payload.code ? `code: ${payload.code}` : '']
      .filter(Boolean)
      .join(' / ')
  }

  return 'Unknown Supabase error.'
}

export async function getCloudSyncState(): Promise<CloudSyncState> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      configured: false,
      user: null,
    }
  }

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return {
      configured: true,
      user: null,
    }
  }

  return {
    configured: true,
    user: data.user,
  }
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase.auth.signUp({ email, password })
}

export async function signOutCloud() {
  if (!supabase) {
    return
  }

  await supabase.auth.signOut()
}

export async function saveCloudData(userId: string, data: AppData) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase.from('notebook_data').upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(formatSupabaseError(error))
  }
}

export async function loadCloudData(userId: string): Promise<Pick<CloudNotebookRow, 'data' | 'updated_at'> | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.from('notebook_data').select('data, updated_at').eq('user_id', userId).maybeSingle()

  if (error) {
    throw new Error(formatSupabaseError(error))
  }

  return data as Pick<CloudNotebookRow, 'data' | 'updated_at'> | null
}

export async function diagnoseCloudSync(userId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase.from('notebook_data').select('user_id').eq('user_id', userId).limit(1)

  if (error) {
    throw new Error(formatSupabaseError(error))
  }

  return 'Supabase 连接正常，notebook_data 表和读取权限可用。'
}

import { createClient } from '@supabase/supabase-js'
import type { AppData } from '../types/domain'

export type CloudNotebookRow = {
  user_id: string
  data: AppData
  updated_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

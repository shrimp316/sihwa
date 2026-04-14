import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as unknown as ReturnType<typeof createClient>

export type Quarter = {
  id: string
  title: string
  intro?: string
  order: number
}

export type Round = {
  id: string
  quarter_id: string
  num: number
  title: string
  order: number
}

export type Poem = {
  id: string
  round_id: string
  poet: string
  title: string
  body: string
  order: number
}

export type FreePoem = {
  id: string
  quarter_id: string
  poet: string
  title: string
  body: string
  order: number
}

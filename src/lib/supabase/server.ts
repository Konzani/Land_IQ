import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  return client
}

export async function readCache<T>(table: string, key: string, maxAgeMs: number): Promise<T | null> {
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data } = await db.from(table).select('payload, cached_at').eq('grid_id', key).maybeSingle()
  if (!data?.cached_at) return null
  if (Date.now() - new Date(data.cached_at as string).getTime() > maxAgeMs) return null
  return data.payload as T
}

export async function writeCache(table: string, key: string, payload: unknown): Promise<void> {
  const db = getSupabaseAdmin()
  if (!db) return
  await db.from(table).upsert({ grid_id: key, payload, cached_at: new Date().toISOString() })
}

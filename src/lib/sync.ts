import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeData } from './merge'
import { parseImport, type Store } from './store'
import type { AppData } from './types'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const syncAvailable = !!(URL && KEY)
const client: SupabaseClient | null = syncAvailable ? createClient(URL!, KEY!) : null

export type SyncState = 'off' | 'signed-out' | 'syncing' | 'ok' | 'error'

export function useSync(store: Store) {
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<SyncState>(syncAvailable ? 'signed-out' : 'off')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(syncAvailable) // true until we know whether someone is signed in
  const dataRef = useRef(store.data)
  dataRef.current = store.data
  const busy = useRef(false)

  useEffect(() => {
    if (!client) return
    client.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {}).finally(() => setLoading(false))
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const syncNow = useCallback(async () => {
    if (!client || !session || busy.current) return
    busy.current = true
    setState('syncing')
    try {
      const { data: row, error: e1 } = await client.from('trck_state').select('data').eq('user_id', session.user.id).maybeSingle()
      if (e1) throw e1
      const local = dataRef.current
      const remote: AppData | null = row?.data ? parseImport(JSON.stringify(row.data)) : null
      if (remote && row?.data && typeof (row.data as AppData).su === 'number') remote.su = (row.data as AppData).su
      const merged = remote ? mergeData(local, remote) : local
      if (JSON.stringify(merged) !== JSON.stringify(local)) store.replace(merged)
      if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) {
        const { error: e2 } = await client.from('trck_state').upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() })
        if (e2) throw e2
      }
      setState('ok'); setError('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState('error'); setError(/newer version/.test(msg) ? 'Your cloud copy is from a newer version of TRCK. Update the app, then sync again.' : msg)
    } finally {
      busy.current = false
    }
  }, [session, store])

  // Push shortly after every change, and pull when the app comes back to the foreground.
  useEffect(() => {
    if (!session) return
    const t = setTimeout(syncNow, 1500)
    return () => clearTimeout(t)
  }, [store.data, session, syncNow])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void syncNow() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [syncNow])
  useEffect(() => { if (!session && syncAvailable) setState('signed-out') }, [session])

  const signIn = async (email: string, password: string, create: boolean) => {
    if (!client) return 'Sync is not set up in this build.'
    const r = create ? await client.auth.signUp({ email, password }) : await client.auth.signInWithPassword({ email, password })
    if (r.error) return r.error.message
    if (create && !r.data.session) return 'Account created. Confirm the email Supabase sent, then sign in.'
    return ''
  }
  const signOut = async () => { await client?.auth.signOut() }

  return { state, error, loading, email: session?.user.email ?? null, signIn, signOut, syncNow }
}

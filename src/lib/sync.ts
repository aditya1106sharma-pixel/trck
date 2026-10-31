import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeData } from './merge'
import { clearOwner, ownerAction, readOwner, writeOwner } from './owner'
import { createSyncQueue } from './queue'
import { needsSetup } from './setup'
import { blankData, parseImport, saveBackup, type Store } from './store'
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
  const queue = useRef(createSyncQueue()).current

  useEffect(() => {
    if (!client) return
    client.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {}).finally(() => setLoading(false))
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  /** Resolves true when this device and the cloud now match. One sync runs at a time. */
  const syncNow = useCallback((): Promise<boolean> => {
    const who = session
    if (!client || !who) return Promise.resolve(false)
    return queue.run(async (isCurrent) => {
      // The stored session is the truth. This function may belong to a render from before a sign out.
      const stillSignedIn = async () => isCurrent() && (await client.auth.getSession()).data.session?.user.id === who.user.id
      const bail = (): false => { setState('signed-out'); return false }
      if (!(await stillSignedIn())) return bail()
      setState('syncing')
      try {
        // A different person's log must never be merged into this account. Keep a copy, then start empty.
        if (ownerAction(readOwner(), who.user.id, !needsSetup(dataRef.current)) === 'clear') {
          if (!saveBackup(JSON.stringify(dataRef.current), 'another account was here')) {
            throw new Error('Another log is on this device and there is no room to keep a copy of it, so nothing was changed. Download a backup, free some space, then sync again.')
          }
          const blank = blankData()
          dataRef.current = blank
          store.replace(blank)
        }
        const { data: row, error: e1 } = await client.from('trck_state').select('data').eq('user_id', who.user.id).maybeSingle()
        if (e1) throw e1
        if (!(await stillSignedIn())) return bail()
        writeOwner(who.user.id)
        const local = dataRef.current
        const remote: AppData | null = row?.data ? parseImport(JSON.stringify(row.data)) : null
        if (remote && row?.data && typeof (row.data as AppData).su === 'number') remote.su = (row.data as AppData).su
        const merged = remote ? mergeData(local, remote) : local
        if (JSON.stringify(merged) !== JSON.stringify(local)) store.replace(merged)
        if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) {
          if (!(await stillSignedIn())) return bail()
          const { error: e2 } = await client.from('trck_state').upsert({ user_id: who.user.id, data: merged, updated_at: new Date().toISOString() })
          if (e2) throw e2
        }
        setState('ok'); setError('')
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setState('error'); setError(/newer version/.test(msg) ? 'Your cloud copy is from a newer version of TRCK. Update the app, then sync again.' : msg)
        return false
      }
    })
  }, [session, store, queue])

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

  /**
   * Ends the session, then clears this device so the next person starts empty.
   * Any sync in flight is allowed to finish first and none can start after. If a copy cannot be kept, nothing is cleared.
   */
  const signingOut = useRef(false)
  const signOut = async (): Promise<boolean> => {
    if (!client || signingOut.current) return false // a second tap must not save a blank copy over a real one
    signingOut.current = true
    try {
      await queue.stop()
      if (!saveBackup(JSON.stringify(dataRef.current), 'before sign out')) return false
      const { error: e } = await client.auth.signOut()
      if (e) return false
      saveBackup(JSON.stringify(dataRef.current), 'before sign out') // anything typed while signing out; skipped when identical
      store.replace(blankData())
      clearOwner()
      return true
    } finally {
      signingOut.current = false
    }
  }

  return { state, error, loading, email: session?.user.email ?? null, signIn, signOut, syncNow }
}

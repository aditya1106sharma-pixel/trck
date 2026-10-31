import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanCode, friendlyAuthError, friendlyCodeError, recoveryKind, recoveryTokens, resetRedirect } from './auth'
import { nextStamp, pushMerge, type Remote } from './cas'
import { clearOwner, ownerAction, readOwner, writeOwner } from './owner'
import { failureOf, type Failure } from './photo'
import { createSyncQueue } from './queue'
import { needsSetup } from './setup'
import { blankData, saveBackup, type Store } from './store'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const syncAvailable = !!(URL && KEY)
// A reset email lands here with its proof in the address. Read it now and wipe the address at once, so the tokens
// never sit in the browser history. The Supabase client is told not to read the address itself.
const RESET_LINK = syncAvailable ? recoveryKind(window.location.hash, window.location.search) : null
const RESET_TOKENS = RESET_LINK === 'recovery' ? recoveryTokens(window.location.hash) : null
if (RESET_LINK) { try { history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ } }
const client: SupabaseClient | null = syncAvailable ? createClient(URL!, KEY!, { auth: { detectSessionInUrl: false } }) : null
// The link only counts if Supabase accepts its tokens. Started once, here, so a second render cannot spend them twice.
const RESET_PROOF: Promise<boolean> | null = client && RESET_TOKENS
  ? client.auth.setSession(RESET_TOKENS).then((r) => !r.error && !!r.data.session, () => false)
  : null

const offline = () => navigator.onLine === false
export type PhotoResult = { ok: true; text: string } | { ok: false; why: Failure }

/** Sends a resized meal photo to the meal-photo Edge Function. The photo is not kept anywhere. */
export async function readMealPhoto(image: string, note: string): Promise<PhotoResult> {
  if (!client || !URL || !KEY) return { ok: false, why: 'not-set-up' }
  if (offline()) return { ok: false, why: 'offline' }
  const token = (await client.auth.getSession()).data.session?.access_token
  if (!token) return { ok: false, why: 'signed-out' }
  try {
    const r = await fetch(`${URL}/functions/v1/meal-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, note }),
      signal: AbortSignal.timeout(40_000),
    })
    const text = await r.text()
    if (r.ok) return { ok: true, text }
    let body: unknown = null
    try { body = JSON.parse(text) } catch { /* not JSON */ }
    return { ok: false, why: failureOf(r.status, body) }
  } catch {
    return { ok: false, why: offline() ? 'offline' : 'failed' }
  }
}

export type SyncState = 'off' | 'signed-out' | 'syncing' | 'ok' | 'error'

export function useSync(store: Store) {
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<SyncState>(syncAvailable ? 'signed-out' : 'off')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(syncAvailable) // true until we know whether someone is signed in
  const [recoveryOver, setRecoveryOver] = useState(false)
  const [proven, setProven] = useState(false) // Supabase accepted the tokens from a reset link
  const dataRef = useRef(store.data)
  dataRef.current = store.data
  const queue = useRef(createSyncQueue()).current

  useEffect(() => {
    if (!client) return
    ;(async () => {
      if (RESET_PROOF) setProven(await RESET_PROOF)
      setSession((await client.auth.getSession()).data.session)
    })().catch(() => {}).finally(() => setLoading(false))
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
        const uid = who.user.id
        const remote: Remote = {
          async read() {
            const { data: row, error } = await client.from('trck_state').select('data, updated_at').eq('user_id', uid).maybeSingle()
            if (error) throw error
            return row ? { data: row.data, updated_at: row.updated_at as string } : null
          },
          // Only writes if the row is still the one we read. Zero rows changed means another device saved first.
          async write(data, expected) {
            const next = nextStamp(expected)
            if (expected === null) {
              const { error } = await client.from('trck_state').insert({ user_id: uid, data, updated_at: next })
              if (error?.code === '23505') return { ok: false } // someone created the row a moment ago
              if (error) throw error
              return { ok: true }
            }
            const { data: rows, error } = await client.from('trck_state').update({ data, updated_at: next }).eq('user_id', uid).eq('updated_at', expected).select('user_id')
            if (error) throw error
            return { ok: !!rows?.length }
          },
        }
        const outcome = await pushMerge({
          remote,
          getLocal: () => dataRef.current,
          apply: (m) => { dataRef.current = m; store.replace(m) },
          guard: async () => {
            const ok = await stillSignedIn()
            if (ok) writeOwner(uid)
            return ok
          },
        })
        if (outcome === 'cancelled') return bail()
        if (outcome === 'busy') throw new Error('Another device is saving at the same moment. Tap Sync now in a few seconds.')
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
    if (r.error) return friendlyAuthError(r.error.message)
    if (create && !r.data.session) return 'Account created. Confirm the email Supabase sent, then sign in.'
    return ''
  }

  /** Emails a one time code. No password is involved. Returns a message only on failure. */
  const sendCode = async (email: string): Promise<string> => {
    if (!client) return 'Sync is not set up in this build.'
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    return error ? friendlyAuthError(error.message) : ''
  }
  /** Checks the code from the email. On success the session starts and the app picks it up. Returns a message only on failure. */
  const verifyCode = async (email: string, code: string): Promise<string> => {
    if (!client) return 'Sync is not set up in this build.'
    const { error } = await client.auth.verifyOtp({ email, token: cleanCode(code), type: 'email' })
    return error ? friendlyCodeError(error.message) : ''
  }

  /** Asks Supabase to email a reset link. The answer is the same whether or not the address has an account. */
  const resetPassword = async (email: string): Promise<{ ok: boolean; message: string }> => {
    if (!client) return { ok: false, message: 'Sync is not set up in this build.' }
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect(window.location) })
    if (error) return { ok: false, message: friendlyAuthError(error.message) }
    return { ok: true, message: 'If that address has an account, a reset link is on its way. It can take a few minutes. Check spam.' }
  }
  const endRecovery = () => {
    setRecoveryOver(true)
    try { history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
  }
  /** After a good reset link the person is signed in, so this just sets the new password. Returns a message only on failure. */
  const setNewPassword = async (pw: string): Promise<string> => {
    if (!client) return 'Sync is not set up in this build.'
    const { error } = await client.auth.updateUser({ password: pw })
    if (error) return friendlyAuthError(error.message)
    endRecovery()
    return ''
  }
  // 'ready' only when Supabase accepted the link's tokens. Anything else that looked like a reset link is 'expired'.
  // Nothing is decided until we know who is signed in.
  const recovery: 'ready' | 'expired' | null = loading || recoveryOver || !RESET_LINK ? null : RESET_LINK === 'recovery' && proven && session ? 'ready' : 'expired'

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

  return { state, error, loading, recovery, email: session?.user.email ?? null, signIn, sendCode, verifyCode, resetPassword, setNewPassword, endRecovery, signOut, syncNow }
}

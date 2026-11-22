// Everything that talks to Supabase lives here. Screens call these functions and never build queries themselves.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { friendlyError, isNetworkError } from './lib/errors'
import type { Client, Gym, Home, JoinRequest, Membership, Message, Method, Payment, Plan, Staff, Who } from './lib/types'

const URL = import.meta.env.VITE_GYM_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_GYM_SUPABASE_ANON_KEY as string | undefined
export const configured = !!(URL && KEY)
export const VERSION = __GYM_VERSION__

// PKCE keeps the hash free for our own screens: Google sends people back with ?code=, which the client swaps for a session.
export const sb: SupabaseClient | null = configured
  ? createClient(URL!, KEY!, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, storageKey: 'trck-gym-auth' } })
  : null

/** Throws an Error whose message is safe to show. Database rule messages pass through, anything else is reworded. */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!sb) throw new Error('The app is not connected to its database yet.')
  const { data, error } = await sb.rpc(fn, args)
  if (error) {
    if (!isNetworkError(error.message)) void logError(`rpc ${fn}: ${error.message}`, error.code)
    throw new Error(friendlyError(error))
  }
  return data as T
}

/** Reads a whole table the signed in person may see, 1000 rows at a time, so nothing is cut off as the gym grows. */
async function all<T>(table: string, order: string, ascending = true): Promise<T[]> {
  if (!sb) return []
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').order(order, { ascending }).order('id').range(from, from + 999)
    if (error) {
      if (!isNetworkError(error.message)) void logError(`read ${table}: ${error.message}`, error.code)
      throw new Error(friendlyError(error))
    }
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

async function write(p: PromiseLike<{ error: { message: string; code?: string } | null }>, what: string): Promise<void> {
  const { error } = await p
  if (error) {
    if (!isNetworkError(error.message)) void logError(`${what}: ${error.message}`, error.code)
    throw new Error(friendlyError(error))
  }
}

// ---------------------------------------------------------------- sign in

export function useSession(): { session: Session | null; ready: boolean } {
  const [state, setState] = useState<{ session: Session | null; ready: boolean }>({ session: null, ready: !sb })
  useEffect(() => {
    if (!sb) return
    let alive = true
    sb.auth.getSession().then(({ data }) => { if (alive) setState({ session: data.session, ready: true }) }, () => { if (alive) setState({ session: null, ready: true }) })
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      if (!alive) return
      setState({ session, ready: true })
      if (session && window.location.search.includes('code=')) {
        try { history.replaceState(null, '', window.location.pathname + window.location.hash) } catch { /* ignore */ }
      }
    })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return state
}

export async function signInWithGoogle(): Promise<void> {
  if (!sb) throw new Error('The app is not connected to its database yet.')
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
  })
  if (error) throw new Error(friendlyError(error))
}

export async function signOut(): Promise<void> {
  if (sb) await sb.auth.signOut()
  window.location.hash = ''
}

export const whoami = () => rpc<Who>('whoami')
export const myHome = () => rpc<Home | null>('my_home')

// ---------------------------------------------------------------- public join form

export interface JoinInfo { name: string; open: boolean; plans: Pick<Plan, 'id' | 'name' | 'price' | 'months' | 'days'>[] }
export const joinInfo = (slug: string) => rpc<JoinInfo | null>('join_info', { p_slug: slug })
export const submitJoin = (slug: string, payload: Record<string, unknown>) => rpc<string>('submit_join_request', { p_slug: slug, p: payload })

// ---------------------------------------------------------------- owner and staff

export interface GymData {
  gym: Gym
  plans: Plan[]
  staff: Staff[]
  requests: JoinRequest[]
  clients: Client[]
  memberships: Membership[]
  payments: Payment[]
}

export async function loadGym(gymId: string): Promise<GymData> {
  if (!sb) throw new Error('The app is not connected to its database yet.')
  const g = await sb.from('gyms').select('*').eq('id', gymId).single()
  if (g.error) throw new Error(friendlyError(g.error))
  const [plans, staff, requests, clients, memberships, payments] = await Promise.all([
    all<Plan>('plans', 'sort'), all<Staff>('staff', 'created_at'), all<JoinRequest>('join_requests', 'created_at', false),
    all<Client>('clients', 'full_name'), all<Membership>('memberships', 'start_date'), all<Payment>('payments', 'paid_on', false),
  ])
  return { gym: g.data as Gym, plans, staff, requests, clients, memberships, payments }
}

export interface PlanInput { plan: string; start: string; price: number; paid: number; method: Method | null; paidOn: string; note: string }
const planArgs = (i: PlanInput) => ({ p_plan: i.plan, p_start: i.start, p_price: i.price, p_paid: i.paid, p_method: i.paid > 0 ? i.method : null, p_paid_on: i.paidOn, p_note: i.note || null })

export const approveRequest = (requestId: string, i: PlanInput) =>
  rpc<{ client_id: string; membership_id: string; payment_id: string | null }>('approve_join_request', { p_request: requestId, ...planArgs(i) })
export const rejectRequest = (requestId: string, reason: string) => rpc<void>('reject_join_request', { p_request: requestId, p_reason: reason || null })
export const addMembership = (clientId: string, i: PlanInput) =>
  rpc<{ client_id: string; membership_id: string; payment_id: string | null }>('add_membership', { p_client: clientId, ...planArgs(i) })
export const addPayment = (clientId: string, membershipId: string | null, amount: number, method: Method, paidOn: string, note: string) =>
  rpc<string>('add_payment', { p_client: clientId, p_membership: membershipId, p_amount: amount, p_method: method, p_paid_on: paidOn, p_note: note || null })
export const voidPayment = (id: string, reason: string) => rpc<void>('void_payment', { p_payment: id, p_reason: reason })
export const cancelMembership = (id: string, reason: string) => rpc<void>('cancel_membership', { p_membership: id, p_reason: reason })

export type ClientEdit = Partial<Pick<Client, 'full_name' | 'phone' | 'email' | 'dob' | 'gender' | 'goal' | 'emergency_name' | 'emergency_phone' | 'source' | 'notes' | 'archived' | 'consent_whatsapp'>>

export async function addClient(gymId: string, c: ClientEdit & { full_name: string; phone: string }): Promise<string> {
  if (!sb) throw new Error('The app is not connected to its database yet.')
  const { data, error } = await sb.from('clients').insert({ gym_id: gymId, ...c }).select('id').single()
  if (error) throw new Error(friendlyError(error))
  return (data as { id: string }).id
}
export const updateClient = (id: string, c: ClientEdit) => write(sb!.from('clients').update(c).eq('id', id), 'update client')

export async function clientMessages(clientId: string): Promise<Message[]> {
  if (!sb) return []
  const { data, error } = await sb.from('messages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30)
  if (error) throw new Error(friendlyError(error))
  return (data ?? []) as Message[]
}

/** Keeps a record that a message was copied or opened in WhatsApp. Never blocks the person if it fails. */
export async function logMessage(gymId: string, m: { client_id?: string | null; request_id?: string | null; kind: string; channel: 'copy' | 'whatsapp'; body: string }, userId: string) {
  if (!sb) return
  const { error } = await sb.from('messages').insert({ gym_id: gymId, sent_by: userId, ...m, body: m.body.slice(0, 2000) })
  if (error && !isNetworkError(error.message)) void logError(`log message: ${error.message}`, error.code)
}

// Owner only. The database refuses these for staff.
export const savePlan = (p: Partial<Plan> & { gym_id: string }) =>
  p.id ? write(sb!.from('plans').update({ name: p.name, months: p.months, days: p.days, price: p.price, active: p.active, sort: p.sort }).eq('id', p.id), 'save plan')
    : write(sb!.from('plans').insert(p), 'add plan')
export const saveGym = (id: string, g: Partial<Pick<Gym, 'name' | 'phone' | 'address' | 'templates' | 'join_open'>>) => write(sb!.from('gyms').update(g).eq('id', id), 'save gym')
export const addStaff = (gymId: string, email: string, role: 'owner' | 'staff', name: string) =>
  write(sb!.from('staff').insert({ gym_id: gymId, email: email.trim().toLowerCase(), role, name: name || null }), 'add staff')
export const removeStaff = (id: string) => write(sb!.from('staff').delete().eq('id', id), 'remove staff')

export interface Insights { counts: Record<string, number>; visitors: number; errors: { id: number; message: string; url: string | null; app_version: string | null; created_at: string }[] }
export const insights = (gymId: string, days = 30) => rpc<Insights>('insights', { p_gym: gymId, p_days: days })

/** Everything the owner can see, as one JSON file. Their own copy, in case anything ever goes wrong. */
export async function backup(gymId: string): Promise<Record<string, unknown>> {
  const d = await loadGym(gymId)
  const messages = await all<Message>('messages', 'created_at')
  return { exported_at: new Date().toISOString(), app_version: VERSION, ...d, messages }
}

// ---------------------------------------------------------------- analytics and errors

function anonId(): string {
  try {
    let id = localStorage.getItem('trck-gym-anon')
    if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('trck-gym-anon', id) }
    return id
  } catch { return 'no-storage' }
}

/** Counts something that happened. Fire and forget: a failed count never bothers the person. */
export function track(name: string, props: Record<string, unknown> = {}, slug?: string): void {
  if (!sb) return
  sb.rpc('track', { p_name: name, p_props: props, p_slug: slug ?? null, p_anon: anonId() }).then(() => undefined, () => undefined)
}

const sentErrors = new Set<string>()
/** Saves an app error for the owner's Insights screen and for debugging with Claude. At most 20 different ones per visit. */
export async function logError(message: string, stack?: string | null): Promise<void> {
  if (!sb || sentErrors.has(message) || sentErrors.size >= 20) return
  sentErrors.add(message)
  try {
    await sb.rpc('log_error', { p_message: message.slice(0, 500), p_stack: stack?.slice(0, 4000) ?? null, p_url: window.location.pathname + window.location.hash.split('/').slice(0, 2).join('/'), p_user_agent: navigator.userAgent.slice(0, 300), p_version: VERSION })
  } catch { /* nothing more we can do */ }
}

export function watchErrors(): void {
  window.addEventListener('error', (e) => { void logError(String(e.message || 'error'), e.error instanceof Error ? e.error.stack : null) })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    const msg = r instanceof Error ? r.message : String(r)
    if (!isNetworkError(msg)) void logError('unhandled: ' + msg, r instanceof Error ? r.stack : null)
  })
}

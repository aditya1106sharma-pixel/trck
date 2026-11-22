// The owner and staff app: loads the gym once, keeps it fresh, and routes between tabs.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { approveRequest, loadGym, rejectRequest, track, type GymData } from '../api'
import { ageOn, fmtDate, todayIn } from '../lib/dates'
import { buildVars, firstName } from '../lib/messages'
import { inr } from '../lib/money'
import { displayPhone } from '../lib/phone'
import { buildRows, endsInWords, todayLists, type Row } from '../lib/status'
import type { TemplateKind } from '../lib/types'
import { HEALTH_QUESTIONS } from '../lib/join'
import { Failed, Field, go, Loading, Sheet, toast, useBusy, useRoute } from '../ui/bits'
import { MessageSheet, PlanForm } from '../ui/forms'
import { ClientDetail, Clients } from './Clients'
import { More, Money } from './More'

export interface Ctx {
  data: GymData
  rows: Row[]
  today: string
  role: 'owner' | 'staff'
  userId: string
  reload: () => Promise<void>
  portalLink: string
}
const C = createContext<Ctx | null>(null)
export const useGym = (): Ctx => { const c = useContext(C); if (!c) throw new Error('useGym outside the owner app'); return c }

export function Owner({ gymId, role, userId }: { gymId: string; role: 'owner' | 'staff'; userId: string }) {
  const [data, setData] = useState<GymData | null>(null)
  const [err, setErr] = useState('')
  const route = useRoute()

  const reload = useCallback(async () => {
    try { setData(await loadGym(gymId)); setErr('') } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load.') }
  }, [gymId])
  useEffect(() => { void reload() }, [reload])
  // Owner and staff may both be working: refresh whenever the app comes back to the front.
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [reload])

  const today = todayIn(data?.gym.time_zone)
  const rows = useMemo(() => (data ? buildRows(data.clients, data.memberships, data.payments, today) : []), [data, today])
  if (!data) return err ? <div className="page"><Failed message={err} retry={() => void reload()} /></div> : <div className="page"><Loading /></div>

  const ctx: Ctx = { data, rows, today, role, userId, reload, portalLink: window.location.origin + window.location.pathname }
  const tab = route[0] ?? 'today'
  const pending = data.requests.filter((r) => r.status === 'pending').length
  const tabs: [string, string][] = [['today', 'Today'], ['requests', 'Requests'], ['clients', 'Clients'], ...(role === 'owner' ? [['money', 'Money'] as [string, string]] : []), ['more', 'More']]

  let screen
  if (tab === 'requests' && route[1]) screen = <RequestDetail id={route[1]} />
  else if (tab === 'requests') screen = <Requests />
  else if (tab === 'clients' && route[1]) screen = <ClientDetail id={route[1]} open={route[2] as TemplateKind | undefined} />
  else if (tab === 'clients') screen = <Clients />
  else if (tab === 'money' && role === 'owner') screen = <Money />
  else if (tab === 'more') screen = <More sub={route[1]} />
  else screen = <Today />

  return (
    <C.Provider value={ctx}>
      <div className="app owner">
        <main className="page">{screen}</main>
        <nav className="tabs" aria-label="Sections">
          {tabs.map(([k, label]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
              {label}{k === 'requests' && pending > 0 && <span className="badge" aria-label={`${pending} waiting`}>{pending}</span>}
            </button>
          ))}
        </nav>
      </div>
    </C.Provider>
  )
}

export function Top({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  const { data } = useGym()
  return (
    <div className="top">
      {back && <button className="back" onClick={() => go(back)} aria-label="Back">Back</button>}
      <span className="brand">{back ? title : <>{data.gym.name}<i>.</i></>}</span>
      <div className="end">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------- Today

type Msg = { row: Row; kind: TemplateKind } | null

export function useMessage(): [Msg, (m: Msg) => void, JSX.Element | null] {
  const { data, userId, portalLink } = useGym()
  const [msg, setMsg] = useState<Msg>(null)
  const close = useCallback(() => setMsg(null), [])
  const el = msg ? (() => {
    const c = msg.row.client
    const pays = data.payments.filter((p) => p.client_id === c.id)
    return (
      <MessageSheet gym={data.gym} userId={userId} name={c.full_name} phone={c.phone} consent={c.consent_whatsapp} clientId={c.id}
        kinds={['renewal', 'expired', 'due', 'welcome', 'portal']} initial={msg.kind} onClose={close}
        vars={() => buildVars({ gym: data.gym, name: c.full_name, email: c.email, link: portalLink, status: msg.row.status, payments: pays })} />
    )
  })() : null
  return [msg, setMsg, el]
}

function Today() {
  const { data, rows, today } = useGym()
  const t = todayLists(rows, data.requests)
  const [, setMsg, sheet] = useMessage()
  const nothing = !t.requests.length && !t.ending.length && !t.expired.length && !t.dues.length

  return (
    <>
      <Top title="Today"><span className="sm mut">{fmtDate(today)}</span></Top>
      <section>
        <div className="kv k4">
          <div><b>{t.counts.active}</b><span>active members</span></div>
          <div><b className={t.counts.requests ? 'warn' : ''}>{t.counts.requests}</b><span>waiting to join</span></div>
          <div><b className={t.counts.ending ? 'warn' : ''}>{t.counts.ending}</b><span>ending this week</span></div>
          <div><b className={t.counts.due ? 'bad' : ''}>{inr(t.counts.due)}</b><span>money due</span></div>
        </div>
      </section>
      {nothing && (
        <section className="stack">
          <p>Nothing needs you today.</p>
          {!data.clients.length && <p className="mut sm">Share the join link from More so new members can send their details, or add a member in Clients.</p>}
        </section>
      )}
      {t.requests.length > 0 && (
        <section>
          <header><h2>Waiting to join</h2><button className="link" onClick={() => go('requests')}>All</button></header>
          <div className="list">{t.requests.slice(0, 5).map((r) => (
            <button className="item" key={r.id} onClick={() => go('requests/' + r.id)}>
              <div className="who"><b>{r.full_name}</b><span>{displayPhone(r.phone)} · sent {fmtDate(r.created_at.slice(0, 10), true)}{r.health_flag ? ' · health note' : ''}</span></div>
              <span className="pill warn">Review</span>
            </button>
          ))}</div>
        </section>
      )}
      <ActList title="Ending this week" rows={t.ending} detail={(r) => `${r.status.current?.plan_name ?? ''} ends ${endsInWords(r.status.daysLeft ?? 0)}`} tone="warn" kind="renewal" onMsg={setMsg} />
      <ActList title="Ended in the last 30 days" rows={t.expired} detail={(r) => `${r.status.latest?.plan_name ?? ''} ended ${fmtDate(r.status.latest?.end_date, true)}`} tone="bad" kind="expired" onMsg={setMsg} />
      <ActList title="Money due" rows={t.dues} detail={(r) => `${inr(r.status.due)} due`} tone="bad" kind="due" onMsg={setMsg} />
      {sheet}
    </>
  )
}

function ActList({ title, rows, detail, tone, kind, onMsg }: { title: string; rows: Row[]; detail: (r: Row) => string; tone: string; kind: TemplateKind; onMsg: (m: Msg) => void }) {
  if (!rows.length) return null
  return (
    <section>
      <header><h2>{title}</h2><span className="sm mut">{rows.length}</span></header>
      <div className="list">{rows.map((r) => (
        <div className="item" key={r.client.id}>
          <button className="who" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, minHeight: 44 }} onClick={() => go('clients/' + r.client.id)}>
            <b>{r.client.full_name}</b><span className={tone}>{detail(r)}</span>
          </button>
          <button className="btn sm ghost" onClick={() => onMsg({ row: r, kind })} aria-label={`WhatsApp ${r.client.full_name}`}>WhatsApp</button>
        </div>
      ))}</div>
    </section>
  )
}

// ---------------------------------------------------------------- Requests

function Requests() {
  const { data } = useGym()
  const [show, setShow] = useState<'pending' | 'done'>('pending')
  const list = data.requests.filter((r) => (show === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
  const shown = show === 'pending' ? [...list].sort((a, b) => a.created_at.localeCompare(b.created_at)) : list.slice(0, 50)
  return (
    <>
      <Top title="Requests" />
      <section className="stack">
        <h1>Join requests</h1>
        <div className="chips">
          <button className="chip" aria-pressed={show === 'pending'} onClick={() => setShow('pending')}>Waiting {data.requests.filter((r) => r.status === 'pending').length}</button>
          <button className="chip" aria-pressed={show === 'done'} onClick={() => setShow('done')}>Handled</button>
        </div>
        {shown.length ? <div className="list">{shown.map((r) => (
          <button className="item" key={r.id} onClick={() => go('requests/' + r.id)}>
            <div className="who"><b>{r.full_name}</b><span>{displayPhone(r.phone)} · {fmtDate(r.created_at.slice(0, 10), true)}{r.goal ? ' · ' + r.goal : ''}</span></div>
            {r.status === 'pending' ? (r.health_flag ? <span className="pill warn">Health note</span> : null)
              : <span className={'pill ' + (r.status === 'approved' ? 'ok' : 'mut')}>{r.status === 'approved' ? 'Joined' : 'Declined'}</span>}
          </button>
        ))}</div> : <p className="empty">{show === 'pending' ? 'No one is waiting. New requests from the join link show up here.' : 'Nothing handled yet.'}</p>}
      </section>
    </>
  )
}

function RequestDetail({ id }: { id: string }) {
  const { data, today, reload, userId, rows, portalLink } = useGym()
  const r = data.requests.find((x) => x.id === id)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState(false)
  const [busy, run] = useBusy()
  if (!r) return <><Top title="Request" back="requests" /><p className="empty">This request is no longer here.</p></>
  const existing = rows.find((x) => x.client.phone === r.phone)
  const plan = data.plans.find((p) => p.id === r.plan_interest)
  const age = ageOn(r.dob, today)

  return (
    <>
      <Top title="Request" back="requests" />
      <section className="stack tight">
        <h1>{r.full_name}</h1>
        <p className="num" style={{ fontSize: 22 }}>{displayPhone(r.phone)}</p>
        <p className="sm mut">Sent {fmtDate(r.created_at.slice(0, 10))}{r.email ? ' · ' + r.email : ' · no email, so they cannot sign in yet'}</p>
        {r.status !== 'pending' && <p className={'notice ' + (r.status === 'approved' ? 'ok' : '')}>{r.status === 'approved' ? 'Approved' : 'Declined'} on {fmtDate(r.decided_at?.slice(0, 10))}{r.reject_reason ? `: ${r.reject_reason}` : ''}</p>}
        {existing && r.status === 'pending' && <p className="notice">This phone already belongs to {existing.client.full_name}. Approving adds the new plan to that member.</p>}
      </section>
      <section>
        <div className="timeline">
          <Line k="Age" v={age !== null ? `${age} · born ${fmtDate(r.dob)}` : 'Not given'} />
          <Line k="Gender" v={r.gender ?? 'Not given'} />
          <Line k="Goal" v={r.goal ?? 'Not given'} />
          <Line k="Wants" v={plan ? plan.name : 'Not sure yet'} />
          <Line k="Emergency" v={r.emergency_name || r.emergency_phone ? `${r.emergency_name ?? ''} ${displayPhone(r.emergency_phone)}`.trim() : 'Not given'} />
          <Line k="Heard from" v={r.source ?? 'Not given'} />
          <Line k="WhatsApp" v={r.consent_whatsapp ? 'Agreed to messages' : 'Did not agree'} />
        </div>
      </section>
      <section className="stack tight">
        <h2>Health answers</h2>
        {r.health_flag ? <>
          {HEALTH_QUESTIONS.filter((h) => r.health[h.key]).map((h) => <p key={h.key} className="warn sm">Yes: {h.q}</p>)}
          {r.health_note && <p className="sm">"{r.health_note}"</p>}
          <p className="xs mut">Ask them to check with a doctor before hard training.</p>
        </> : <p className="sm ok">No to every question.</p>}
      </section>
      {r.status === 'pending' && (
        <section className="stack">
          <button className="btn acc block" onClick={() => setApproving(true)}>Approve and start a plan</button>
          <div className="btns">
            <button className="btn ghost" onClick={() => setMsg(true)}>WhatsApp them</button>
            <button className="btn danger" onClick={() => setRejecting(true)}>Decline</button>
          </div>
        </section>
      )}
      {approving && (
        <Sheet title={`Start ${firstName(r.full_name)}'s plan`} onClose={() => setApproving(false)}>
          <PlanForm plans={data.plans} today={today} start={existing?.status.nextStart ?? today} defaultPlan={r.plan_interest} submitLabel="Approve"
            onSubmit={async (i) => {
              const res = await approveRequest(r.id, i)
              track('request_approved', { paid: i.paid > 0 })
              await reload()
              toast('Approved. Send the welcome message.')
              go(`clients/${res.client_id}/welcome`)
            }} />
        </Sheet>
      )}
      {rejecting && (
        <Sheet title="Decline request" onClose={() => setRejecting(false)}>
          <Field label="Reason (only staff see this)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="For example, spam or duplicate" /></Field>
          <button className="btn danger block" disabled={busy} onClick={() => void run(async () => {
            await rejectRequest(r.id, reason)
            track('request_rejected')
            await reload()
            toast('Declined.')
            go('requests')
          })}>Decline</button>
        </Sheet>
      )}
      {msg && <MessageSheet gym={data.gym} userId={userId} name={r.full_name} phone={r.phone} consent={r.consent_whatsapp} requestId={r.id}
        kinds={['trial']} initial="trial" onClose={() => setMsg(false)} vars={() => buildVars({ gym: data.gym, name: r.full_name, link: portalLink })} />}
    </>
  )
}

const Line = ({ k, v }: { k: string; v: string }) => <div><em>{k}</em><span>{v}</span><span /></div>


// The client list, adding a walk in member, and one client's page with plans, payments and messages.
import { useEffect, useState } from 'react'
import { addClient, addMembership, addPayment, cancelMembership, clientMessages, track, updateClient, voidPayment, type ClientEdit } from '../api'
import { ageOn, fmtDate } from '../lib/dates'
import { HEALTH_QUESTIONS } from '../lib/join'
import { buildVars, firstName, TEMPLATE_LABEL } from '../lib/messages'
import { inr } from '../lib/money'
import { displayPhone, normalizePhone } from '../lib/phone'
import { dueOn, endsInWords, filterRows, STATE_LABEL, type Filter, type Row } from '../lib/status'
import { METHOD_LABEL, type Client, type Message, type Payment, type TemplateKind } from '../lib/types'
import { Field, go, Sheet, toast, useBusy } from '../ui/bits'
import { MessageSheet, PaymentForm, PlanForm } from '../ui/forms'
import { Top, useGym } from './Owner'

const FILTERS: [Filter, string][] = [['all', 'All'], ['active', 'Active'], ['ending', 'Ending'], ['expired', 'Expired'], ['due', 'Money due'], ['archived', 'Archived']]

export function stateTone(r: Row): string {
  const s = r.status.state
  return s === 'active' ? 'ok' : s === 'ending' ? 'warn' : s === 'expired' ? 'bad' : 'mut'
}

function statusLine(r: Row): string {
  const s = r.status
  if (s.state === 'active' || s.state === 'ending') return `${s.current?.plan_name} · ends ${s.daysLeft !== null && s.daysLeft <= 7 ? endsInWords(s.daysLeft) : fmtDate(s.coveredThrough, true)}`
  if (s.state === 'upcoming') return `${s.latest?.plan_name} · starts soon`
  if (s.state === 'expired') return `${s.latest?.plan_name} · ended ${fmtDate(s.latest?.end_date, true)}`
  return 'No plan yet'
}

export function Clients() {
  const { rows } = useGym()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const list = filterRows(rows, filter, q)
  const count = (f: Filter) => filterRows(rows, f, '').length
  return (
    <>
      <Top title="Clients"><button className="btn sm acc" onClick={() => setAdding(true)}>Add client</button></Top>
      <section className="stack">
        <Field label="Search by name, phone or email"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <div className="chips">{FILTERS.map(([f, label]) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} {count(f)}</button>)}</div>
        {list.length ? <div className="list">{list.map((r) => (
          <button className="item" key={r.client.id} onClick={() => go('clients/' + r.client.id)}>
            <div className="who"><b>{r.client.full_name}</b><span>{displayPhone(r.client.phone)} · {statusLine(r)}</span></div>
            {r.status.due > 0 ? <span className="pill bad">{inr(r.status.due)} due</span> : <span className={'pill ' + stateTone(r)}>{STATE_LABEL[r.status.state]}</span>}
          </button>
        ))}</div> : <p className="empty">{rows.length ? 'No one matches.' : 'No clients yet. Approve a join request or add one here.'}</p>}
      </section>
      {adding && <ClientSheet onClose={() => setAdding(false)} />}
    </>
  )
}

/** Add a walk in, or edit a client's details. */
function ClientSheet({ client, onClose }: { client?: Client; onClose: () => void }) {
  const { data, reload } = useGym()
  const [f, setF] = useState({
    full_name: client?.full_name ?? '', phone: client ? displayPhone(client.phone) : '', email: client?.email ?? '', dob: client?.dob ?? '',
    goal: client?.goal ?? '', emergency_name: client?.emergency_name ?? '', emergency_phone: client?.emergency_phone ? displayPhone(client.emergency_phone) : '',
    notes: client?.notes ?? '', consent_whatsapp: client?.consent_whatsapp ?? true,
  })
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const phone = normalizePhone(f.phone)
  const eph = f.emergency_phone.trim() ? normalizePhone(f.emergency_phone) : null
  const errs = {
    full_name: f.full_name.trim().length < 2 ? 'Add the full name.' : '',
    phone: phone ? '' : 'Use a 10 digit mobile number.',
    email: f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? 'Check the email.' : '',
    emergency_phone: f.emergency_phone.trim() && !eph ? 'Use a 10 digit mobile number.' : '',
  }
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))
  const show = (k: keyof typeof errs) => (tried ? errs[k] : '')
  return (
    <Sheet title={client ? 'Edit details' : 'Add client'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={(e) => {
        e.preventDefault(); setTried(true)
        if (Object.values(errs).some(Boolean) || !phone) return
        const body: ClientEdit = {
          full_name: f.full_name.trim().replace(/\s+/g, ' '), phone, email: f.email.trim().toLowerCase() || null, dob: f.dob || null,
          goal: f.goal.trim() || null, emergency_name: f.emergency_name.trim() || null, emergency_phone: eph, notes: f.notes.trim() || null,
          consent_whatsapp: f.consent_whatsapp,
        }
        void run(async () => {
          if (client) { await updateClient(client.id, body); await reload(); toast('Saved.'); onClose(); return }
          const id = await addClient(data.gym.id, { ...body, full_name: body.full_name!, phone, source: 'Walked in' })
          track('client_added')
          await reload()
          toast('Added. Start their plan.')
          go('clients/' + id)
        })
      }}>
        <Field label="Full name" error={show('full_name')}><input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} maxLength={80} /></Field>
        <Field label="Mobile number (WhatsApp)" error={show('phone')}><input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Gmail address" error={show('email')} hint="Lets them sign in and see their plan."><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} maxLength={120} /></Field>
        <div className="pair">
          <Field label="Date of birth"><input type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} /></Field>
          <Field label="Goal"><input value={f.goal} onChange={(e) => set('goal', e.target.value)} maxLength={40} /></Field>
        </div>
        <div className="pair">
          <Field label="Emergency contact"><input value={f.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} maxLength={80} /></Field>
          <Field label="Their mobile" error={show('emergency_phone')}><input type="tel" value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} /></Field>
        </div>
        <Field label="Staff notes" hint="Only owner and staff see these."><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} /></Field>
        <label className="check"><input type="checkbox" checked={f.consent_whatsapp} onChange={(e) => set('consent_whatsapp', e.target.checked)} /><span>Agreed to WhatsApp messages</span></label>
        <button className="btn acc block" disabled={busy}>{busy ? 'Saving' : client ? 'Save' : 'Add client'}</button>
      </form>
    </Sheet>
  )
}

type Panel = 'plan' | 'pay' | 'edit' | 'msg' | { void: Payment } | { cancel: string } | { receipt: Payment } | null

export function ClientDetail({ id, open }: { id: string; open?: TemplateKind }) {
  const { data, rows, today, reload, role, userId, portalLink } = useGym()
  const row = rows.find((r) => r.client.id === id)
  const [panel, setPanel] = useState<Panel>(open ? 'msg' : null)
  const [msgKind, setMsgKind] = useState<TemplateKind | undefined>(open)
  const [sent, setSent] = useState<Message[]>([])
  const [reason, setReason] = useState('')
  const [busy, run] = useBusy()
  const refreshSent = () => { clientMessages(id).then(setSent, () => setSent([])) }
  useEffect(refreshSent, [id])
  // Arriving with a message to send (after approving): drop it from the address so Back does not reopen it.
  useEffect(() => { if (open) window.history.replaceState(null, '', '#/clients/' + id) }, [open, id])

  if (!row) return <><Top title="Client" back="clients" /><p className="empty">This client is not here. They may have been removed from your view.</p></>
  const c = row.client
  const s = row.status
  const ms = data.memberships.filter((m) => m.client_id === id).sort((a, b) => b.start_date.localeCompare(a.start_date))
  const ps = data.payments.filter((p) => p.client_id === id)
  const age = ageOn(c.dob, today)
  const close = () => { setPanel(null); setMsgKind(undefined); setReason(''); refreshSent() }
  const suggested: TemplateKind = s.state === 'ending' ? 'renewal' : s.state === 'expired' ? 'expired' : s.due > 0 ? 'due' : 'welcome'

  return (
    <>
      <Top title={firstName(c.full_name)} back="clients"><button className="btn sm ghost" onClick={() => setPanel('edit')}>Edit</button></Top>
      <section className="stack">
        <div className="row sp wrap">
          <h1>{c.full_name}</h1>
          {c.archived ? <span className="pill mut">Archived</span> : <span className={'pill ' + (s.state === 'active' ? 'ok' : s.state === 'ending' ? 'warn' : s.state === 'expired' ? 'bad' : 'mut')}>{STATE_LABEL[s.state]}</span>}
        </div>
        <p className="sm mut"><span className="num" style={{ fontSize: 20, color: 'var(--ink)' }}>{displayPhone(c.phone)}</span>{c.email ? ` · ${c.email}` : ''}{c.user_id ? ' · signed in' : ''}</p>
        <div className="kv">
          <div><b>{s.daysLeft !== null && (s.state === 'active' || s.state === 'ending') ? s.daysLeft : 0}</b><span>{s.daysLeft === 0 ? 'last day today' : 'days to go'}</span></div>
          <div><b>{s.coveredThrough ? fmtDate(s.coveredThrough, true) : 'None'}</b><span>{s.state === 'expired' ? 'ended' : 'covered till'}</span></div>
          <div><b className={s.due > 0 ? 'bad' : ''}>{inr(s.due)}</b><span>due</span></div>
        </div>
        <div className="btns">
          <button className="btn acc" onClick={() => { setMsgKind(suggested); setPanel('msg') }}>WhatsApp</button>
          <button className="btn" onClick={() => setPanel('plan')}>{s.state === 'none' ? 'Start plan' : 'Renew'}</button>
          {s.due > 0 && <button className="btn ghost" onClick={() => setPanel('pay')}>Record payment</button>}
        </div>
      </section>

      <section>
        <header><h2>Plans</h2></header>
        {ms.length ? <div className="timeline">{ms.map((m) => (
          <div key={m.id}>
            <em>{fmtDate(m.start_date, true)}</em>
            <span className={m.status === 'cancelled' ? 'strike' : ''}>{m.plan_name} to {fmtDate(m.end_date)}{m.note ? ` · ${m.note}` : ''}{m.cancel_reason ? ` · cancelled: ${m.cancel_reason}` : ''}
              {m.status === 'active' && dueOn(m, ps) > 0 && <span className="bad"> · {inr(dueOn(m, ps))} due</span>}</span>
            <span className="row">{inr(m.price)}{role === 'owner' && m.status === 'active' && <button className="link xs" onClick={() => setPanel({ cancel: m.id })} aria-label={`Cancel ${m.plan_name} plan`}>Cancel</button>}</span>
          </div>
        ))}</div> : <p className="empty">No plans yet.</p>}
      </section>

      <section>
        <header><h2>Payments</h2>{s.due <= 0 && <button className="link" onClick={() => setPanel('pay')}>Record</button>}</header>
        {ps.length ? <div className="timeline">{ps.map((p) => (
          <div key={p.id}>
            <em>{fmtDate(p.paid_on, true)}</em>
            <span className={p.voided ? 'strike' : ''}>{METHOD_LABEL[p.method]} · receipt {p.receipt_no}{p.note ? ` · ${p.note}` : ''}{p.voided ? ` · voided: ${p.void_reason}` : ''}</span>
            <span className="row"><b className={p.voided ? 'strike' : ''}>{inr(p.amount)}</b>
              {!p.voided && <button className="link xs" onClick={() => setPanel({ receipt: p })} aria-label={`Send receipt ${p.receipt_no}`}>Receipt</button>}
              {!p.voided && role === 'owner' && <button className="link xs" onClick={() => setPanel({ void: p })} aria-label={`Void receipt ${p.receipt_no}`}>Void</button>}</span>
          </div>
        ))}</div> : <p className="empty">No payments yet.</p>}
      </section>

      <section className="stack tight">
        <h2>Details</h2>
        <div className="timeline">
          <div><em>Age</em><span>{age !== null ? `${age} · born ${fmtDate(c.dob)}` : 'Not given'}</span><span /></div>
          <div><em>Goal</em><span>{c.goal ?? 'Not given'}</span><span /></div>
          <div><em>Emergency</em><span>{c.emergency_name || c.emergency_phone ? `${c.emergency_name ?? ''} ${displayPhone(c.emergency_phone)}` : 'Not given'}</span><span /></div>
          <div><em>Health</em><span className={c.health_flag ? 'warn' : ''}>{c.health_flag ? HEALTH_QUESTIONS.filter((h) => c.health[h.key]).map((h) => h.q).join(' ') + (c.health_note ? ` "${c.health_note}"` : '') : 'No to every question'}</span><span /></div>
          <div><em>WhatsApp</em><span>{c.consent_whatsapp ? 'Agreed to messages' : 'Did not agree'}</span><span /></div>
          <div><em>Joined</em><span>{fmtDate(c.created_at.slice(0, 10))}{c.source ? ` · ${c.source}` : ''}</span><span /></div>
          {c.notes && <div><em>Notes</em><span style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</span><span /></div>}
        </div>
      </section>

      <section>
        <header><h2>Messages</h2></header>
        {sent.length ? <div className="timeline">{sent.map((m) => (
          <div key={m.id}><em>{fmtDate(m.created_at.slice(0, 10), true)}</em><span>{TEMPLATE_LABEL[m.kind as TemplateKind] ?? m.kind} · {m.channel === 'whatsapp' ? 'opened in WhatsApp' : 'copied'}</span><span /></div>
        ))}</div> : <p className="empty">No messages yet.</p>}
      </section>

      <section>
        <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { await updateClient(c.id, { archived: !c.archived }); await reload(); toast(c.archived ? 'Back on the list.' : 'Archived. Find them under Archived.') })}>
          {c.archived ? 'Move back to the list' : 'Archive client'}
        </button>
      </section>

      {panel === 'edit' && <ClientSheet client={c} onClose={close} />}
      {panel === 'plan' && (
        <Sheet title={s.state === 'none' ? 'Start a plan' : 'Renew'} onClose={close}>
          {s.state === 'ending' || s.state === 'active' || s.state === 'upcoming' ? <p className="sm mut">Starts the day after the current plan ends.</p> : null}
          <PlanForm plans={data.plans} today={today} start={s.nextStart} defaultPlan={s.latest?.plan_id} submitLabel="Save plan" onSubmit={async (i) => {
            await addMembership(c.id, i)
            track('membership_added', { paid: i.paid > 0, renewal: s.state !== 'none' })
            await reload()
            if (s.state === 'none') { toast('Plan saved. Send the welcome message.'); setMsgKind('welcome'); setPanel('msg') }
            else { toast(i.paid > 0 ? 'Renewed. Send a receipt from Payments.' : 'Renewed.'); close() }
          }} />
        </Sheet>
      )}
      {panel === 'pay' && (
        <Sheet title="Record payment" onClose={close}>
          <PaymentForm memberships={ms} payments={ps} today={today} onSubmit={async (mid, amount, method, paidOn, note) => {
            await addPayment(c.id, mid, amount, method, paidOn, note)
            track('payment_added', { method })
            await reload()
            toast('Payment saved. Send a receipt from Payments.')
            close()
          }} />
        </Sheet>
      )}
      {typeof panel === 'object' && panel && 'void' in panel && (
        <Sheet title={`Void receipt ${panel.void.receipt_no}`} onClose={close}>
          <p className="sm">{inr(panel.void.amount)} on {fmtDate(panel.void.paid_on)}. It stays in the records, crossed out.</p>
          <Field label="Why"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="For example, entered twice" /></Field>
          <button className="btn danger block" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await voidPayment(panel.void.id, reason); await reload(); toast('Voided.'); close() })}>Void payment</button>
        </Sheet>
      )}
      {typeof panel === 'object' && panel && 'cancel' in panel && (
        <Sheet title="Cancel plan" onClose={close}>
          <p className="sm">The plan stays in the records, crossed out, and stops counting days and money due.</p>
          <Field label="Why"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="For example, wrong plan picked" /></Field>
          <button className="btn danger block" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await cancelMembership(panel.cancel, reason); await reload(); toast('Plan cancelled.'); close() })}>Cancel plan</button>
        </Sheet>
      )}
      {panel === 'msg' && (
        <MessageSheet gym={data.gym} userId={userId} name={c.full_name} phone={c.phone} consent={c.consent_whatsapp} clientId={c.id}
          kinds={['welcome', 'renewal', 'expired', 'due', ...(c.email ? ['portal' as const] : [])]} initial={msgKind ?? suggested} onClose={close}
          vars={(k) => buildVars({ gym: data.gym, name: c.full_name, email: c.email, link: portalLink, status: s, payments: ps, membership: k === 'welcome' ? ms.find((m) => m.status === 'active') ?? null : undefined })} />
      )}
      {typeof panel === 'object' && panel && 'receipt' in panel && (
        <MessageSheet gym={data.gym} userId={userId} name={c.full_name} phone={c.phone} consent={c.consent_whatsapp} clientId={c.id}
          kinds={['received']} initial="received" onClose={close}
          vars={() => buildVars({ gym: data.gym, name: c.full_name, status: s, payments: ps, payment: (panel as { receipt: Payment }).receipt, membership: ms.find((m) => m.id === (panel as { receipt: Payment }).receipt.membership_id) ?? null })} />
      )}
    </>
  )
}

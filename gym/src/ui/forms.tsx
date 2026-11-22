// The forms used in more than one place: start a plan, record a payment, send a WhatsApp message.
import { useMemo, useState } from 'react'
import { logMessage, track, type PlanInput } from '../api'
import { fmtDate, isDate, membershipEnd, planLength } from '../lib/dates'
import { render, TEMPLATE_LABEL, templateFor, type Vars } from '../lib/messages'
import { inr, parseAmount } from '../lib/money'
import { displayPhone, waLink } from '../lib/phone'
import { dueOn } from '../lib/status'
import { METHOD_LABEL, METHODS, type Gym, type Membership, type Method, type Payment, type Plan, type TemplateKind } from '../lib/types'
import { copyText, Field, Sheet, toast, useBusy } from './bits'

// ---------------------------------------------------------------- start or renew a plan

export function PlanForm({ plans, today, start, defaultPlan, submitLabel, onSubmit }: {
  plans: Plan[]; today: string; start: string; defaultPlan?: string | null; submitLabel: string; onSubmit: (i: PlanInput) => Promise<unknown>
}) {
  const active = plans.filter((p) => p.active)
  const first = active.find((p) => p.id === defaultPlan) ?? active[0]
  const [planId, setPlanId] = useState(first?.id ?? '')
  const [startDate, setStart] = useState(start)
  const [price, setPrice] = useState(String(first?.price ?? ''))
  const [paid, setPaid] = useState(String(first?.price ?? ''))
  const [method, setMethod] = useState<Method>('upi')
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const plan = active.find((p) => p.id === planId)
  const priceN = parseAmount(price)
  const paidN = paid.trim() === '' ? 0 : parseAmount(paid)
  const errs = {
    plan: plan ? '' : 'Pick a plan.',
    start: isDate(startDate) ? '' : 'Pick a start date.',
    price: priceN === null ? 'Type the price in rupees.' : '',
    paid: paidN === null ? 'Type the amount in rupees, or leave it empty.' : priceN !== null && paidN > priceN ? 'Paid cannot be more than the price.' : '',
    paidOn: paidN && !isDate(paidOn) ? 'Pick the payment date.' : '',
  }
  const ok = !Object.values(errs).some(Boolean)
  const show = (k: keyof typeof errs) => (tried ? errs[k] : '')

  if (!active.length) return <p className="notice">There are no plans yet. The owner adds them under More, Plans.</p>

  const pick = (id: string) => {
    const p = active.find((x) => x.id === id)
    setPlanId(id)
    if (p) { setPrice(String(p.price)); setPaid(String(p.price)) }
  }
  const submit = () => {
    setTried(true)
    if (!ok || !plan || priceN === null || paidN === null) return
    void run(() => onSubmit({ plan: plan.id, start: startDate, price: priceN, paid: paidN, method, paidOn, note }))
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
      <Field label="Plan" error={show('plan')}>
        <select value={planId} onChange={(e) => pick(e.target.value)}>
          {active.map((p) => <option key={p.id} value={p.id}>{p.name} · {planLength(p.months, p.days)} · {inr(p.price)}</option>)}
        </select>
      </Field>
      <div className="pair">
        <Field label="Starts" error={show('start')} hint={plan && isDate(startDate) ? `Ends ${fmtDate(membershipEnd(startDate, plan.months, plan.days))}` : undefined}>
          <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Price in ₹" error={show('price')} hint="Change it for a discount">
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <div className="pair">
        <Field label="Paid now in ₹" error={show('paid')} hint={priceN !== null && paidN !== null && paidN < priceN ? `${inr(priceN - paidN)} will show as due` : 'Leave empty if not paid yet'}>
          <input inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </Field>
        <Field label="Paid on" error={show('paidOn')}>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} disabled={!paidN} />
        </Field>
      </div>
      {!!paidN && <MethodPicker value={method} onChange={setMethod} />}
      <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="For example, festival offer" /></Field>
      <button className="btn acc block" disabled={busy}>{busy ? 'Saving' : submitLabel}</button>
    </form>
  )
}

function MethodPicker({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <div className="field"><span>How they paid</span>
      <div className="choice" role="group" aria-label="How they paid">
        {METHODS.map((m) => <button type="button" key={m} aria-pressed={value === m} onClick={() => onChange(m)}>{METHOD_LABEL[m]}</button>)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- record a payment

export function PaymentForm({ memberships, payments, today, onSubmit }: {
  memberships: Membership[]; payments: Payment[]; today: string
  onSubmit: (membershipId: string | null, amount: number, method: Method, paidOn: string, note: string) => Promise<unknown>
}) {
  const owed = memberships.filter((m) => m.status === 'active' && dueOn(m, payments) > 0).sort((a, b) => a.start_date.localeCompare(b.start_date))
  const [mid, setMid] = useState(owed[0]?.id ?? '')
  const due = (id: string) => { const m = owed.find((x) => x.id === id); return m ? dueOn(m, payments) : 0 }
  const [amount, setAmount] = useState(owed[0] ? String(due(owed[0].id)) : '')
  const [method, setMethod] = useState<Method>('upi')
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, run] = useBusy()
  const n = parseAmount(amount)
  const err = n === null || n < 1 ? 'Type the amount in rupees.' : mid && n > due(mid) ? `Only ${inr(due(mid))} is due on this plan.` : ''
  return (
    <form className="stack" noValidate onSubmit={(e) => {
      e.preventDefault(); setTried(true)
      if (err || n === null || !isDate(paidOn)) return
      void run(() => onSubmit(mid || null, n, method, paidOn, note))
    }}>
      <Field label="For">
        <select value={mid} onChange={(e) => { setMid(e.target.value); setAmount(e.target.value ? String(due(e.target.value)) : '') }}>
          {owed.map((m) => <option key={m.id} value={m.id}>{m.plan_name} from {fmtDate(m.start_date, true)} · {inr(due(m.id))} due</option>)}
          <option value="">Something else, not a plan</option>
        </select>
      </Field>
      <div className="pair">
        <Field label="Amount in ₹" error={tried ? err : ''}><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Paid on"><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
      </div>
      <MethodPicker value={method} onChange={setMethod} />
      <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      <button className="btn acc block" disabled={busy}>{busy ? 'Saving' : 'Record payment'}</button>
    </form>
  )
}

// ---------------------------------------------------------------- WhatsApp message

export function MessageSheet({ gym, userId, name, phone, consent, kinds, initial, vars, clientId, requestId, onClose }: {
  gym: Gym; userId: string; name: string; phone: string; consent: boolean; kinds: TemplateKind[]; initial: TemplateKind
  vars: (k: TemplateKind) => Vars; clientId?: string; requestId?: string; onClose: () => void
}) {
  const [kind, setKind] = useState<TemplateKind>(kinds.includes(initial) ? initial : kinds[0])
  const filled = useMemo(() => render(templateFor(gym, kind), vars(kind)), [gym, kind, vars])
  const [text, setText] = useState(filled)
  const [edited, setEdited] = useState(false)
  const body = edited ? text : filled
  const log = (channel: 'copy' | 'whatsapp') => {
    void logMessage(gym.id, { client_id: clientId ?? null, request_id: requestId ?? null, kind, channel, body }, userId)
    track(channel === 'copy' ? 'message_copied' : 'message_opened', { kind })
  }
  return (
    <Sheet title="Send on WhatsApp" onClose={onClose}>
      <p className="sm mut">To {name} · {displayPhone(phone)}</p>
      {!consent && <p className="notice">This person did not agree to WhatsApp messages on the form. Send only if they asked you to.</p>}
      <div className="stack tight" role="group" aria-label="Which message">
        {kinds.map((k) => (
          <button key={k} type="button" className="tpl" aria-pressed={k === kind} onClick={() => { setKind(k); setEdited(false) }}>
            <b>{TEMPLATE_LABEL[k]}</b>
          </button>
        ))}
      </div>
      <Field label="Message" hint="You can change the words before sending.">
        <textarea value={body} rows={6} onChange={(e) => { setText(e.target.value); setEdited(true) }} />
      </Field>
      <div className="btns">
        <button className="btn ghost" type="button" onClick={async () => { const ok = await copyText(body); toast(ok ? 'Copied. Paste it in WhatsApp.' : 'Could not copy. Select the text and copy it.'); if (ok) log('copy') }}>Copy message</button>
        <a className="btn acc" href={waLink(phone, body)} target="_blank" rel="noopener noreferrer" onClick={() => log('whatsapp')}>Open WhatsApp</a>
      </div>
      <p className="xs mut">WhatsApp opens on this phone with the message typed in. You press send. Nothing is sent by the app.</p>
    </Sheet>
  )
}

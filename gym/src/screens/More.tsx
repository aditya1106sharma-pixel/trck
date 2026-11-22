// Money (owner), and More: join link, plans, staff, message wording, gym details, insights, backup, sign out.
import { useEffect, useState } from 'react'
import { addStaff, backup, insights, removeStaff, saveGym, savePlan, signOut, track, VERSION, type Insights } from '../api'
import { clientsCsv } from '../lib/csv'
import { fmtDate, fmtMonth, planLength } from '../lib/dates'
import { funnelFrom, pct, revenueByMonth } from '../lib/insights'
import { DEFAULT_TEMPLATES, TEMPLATE_KINDS, TEMPLATE_LABEL, TEMPLATE_VARS } from '../lib/messages'
import { inr, parseAmount } from '../lib/money'
import { normalizePhone, displayPhone } from '../lib/phone'
import { METHOD_LABEL, type Plan, type TemplateKind } from '../lib/types'
import { copyText, Field, go, QR, Sheet, toast, useBusy } from '../ui/bits'
import { Top, useGym } from './Owner'

// ---------------------------------------------------------------- Money

export function Money() {
  const { data, rows, today } = useGym()
  const months = revenueByMonth(data.payments, today, 6)
  const max = Math.max(1, ...months.map((m) => m.total))
  const thisMonth = months[months.length - 1]
  const due = rows.filter((r) => !r.client.archived).reduce((s, r) => s + r.status.due, 0)
  const recent = data.payments.filter((p) => !p.voided).slice(0, 30)
  const name = (id: string) => data.clients.find((c) => c.id === id)?.full_name ?? 'Unknown'
  const byMethod = Object.entries(data.payments.filter((p) => !p.voided && p.paid_on.slice(0, 7) === today.slice(0, 7))
    .reduce<Record<string, number>>((a, p) => ({ ...a, [p.method]: (a[p.method] ?? 0) + p.amount }), {})).sort((a, b) => b[1] - a[1])
  return (
    <>
      <Top title="Money" />
      <section className="stack">
        <h2>Collected in {fmtMonth(thisMonth.month)}</h2>
        <div className="big">{inr(thisMonth.total)}</div>
        <p className="sm mut">{thisMonth.count} payment{thisMonth.count === 1 ? '' : 's'}{byMethod.length ? ' · ' + byMethod.map(([m, v]) => `${METHOD_LABEL[m as keyof typeof METHOD_LABEL]} ${inr(v)}`).join(' · ') : ''}</p>
        <div className="kv"><div><b className={due ? 'bad' : ''}>{inr(due)}</b><span>still due from members</span></div></div>
      </section>
      <section>
        <header><h2>Last 6 months</h2></header>
        <div className="bars" role="img" aria-label={months.map((m) => `${fmtMonth(m.month)} ${inr(m.total)}`).join(', ')}>
          {months.map((m) => (
            <div key={m.month}><b>{m.total ? inr(m.total).replace('₹', '') : ''}</b><i style={{ height: `${Math.round((m.total / max) * 100)}%` }} /><span>{fmtMonth(m.month).slice(0, 3)}</span></div>
          ))}
        </div>
      </section>
      <section>
        <header><h2>Recent payments</h2></header>
        {recent.length ? <div className="list">{recent.map((p) => (
          <button className="item" key={p.id} onClick={() => go('clients/' + p.client_id)}>
            <div className="who"><b>{name(p.client_id)}</b><span>{fmtDate(p.paid_on)} · {METHOD_LABEL[p.method]} · receipt {p.receipt_no}</span></div>
            <span className="amt">{inr(p.amount)}</span>
          </button>
        ))}</div> : <p className="empty">No payments yet. They show here when you approve a member or record a payment.</p>}
      </section>
      <p className="xs mut" style={{ padding: '12px 0' }}>Numbers come from what is recorded in the app. Check them against your bank before using them for tax.</p>
    </>
  )
}

// ---------------------------------------------------------------- More

export function More({ sub }: { sub?: string }) {
  const { role } = useGym()
  if (sub === 'plans' && role === 'owner') return <Plans />
  if (sub === 'staff' && role === 'owner') return <StaffPage />
  if (sub === 'messages' && role === 'owner') return <Templates />
  if (sub === 'gym' && role === 'owner') return <GymDetails />
  if (sub === 'insights' && role === 'owner') return <InsightsPage />
  return <MoreHome />
}

function MoreHome() {
  const { data, role, rows, today } = useGym()
  const link = `${window.location.origin}${window.location.pathname}#/join/${data.gym.slug}`
  const [busy, run] = useBusy()
  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const stamp = today
  return (
    <>
      <Top title="More" />
      <section className="stack">
        <h2>Join link</h2>
        <p className="sm mut">New members open this, fill the form, and the request comes to Requests. Print the QR code for the front desk.</p>
        {!data.gym.join_open && <p className="notice">The join form is switched off. Turn it on under Gym details.</p>}
        <p className="code">{link}</p>
        <div className="btns">
          <button className="btn" onClick={async () => { const ok = await copyText(link); toast(ok ? 'Link copied.' : 'Could not copy. Select the link and copy it.'); if (ok) track('join_link_copied') }}>Copy link</button>
          <a className="btn ghost" href={link} target="_blank" rel="noopener noreferrer">Open the form</a>
        </div>
        <QR text={link} label={`QR code for ${link}`} />
      </section>
      {role === 'owner' && (
        <section>
          <header><h2>Owner</h2></header>
          <div className="list">
            {([['insights', 'Insights', 'Join funnel, usage and app problems'], ['plans', 'Plans and prices', `${data.plans.filter((p) => p.active).length} plans on sale`],
              ['messages', 'Message wording', 'Change what the WhatsApp messages say'], ['staff', 'Staff', `${data.staff.length} people can sign in`],
              ['gym', 'Gym details', 'Name, number, address, join form on or off']] as const).map(([k, t, d]) => (
              <button className="item" key={k} onClick={() => go('more/' + k)}><div className="who"><b>{t}</b><span>{d}</span></div><span className="mut">Open</span></button>
            ))}
          </div>
        </section>
      )}
      {role === 'owner' && (
        <section className="stack">
          <h2>Your data</h2>
          <p className="sm mut">Download a full copy now and then. Keep it somewhere safe, like Google Drive. It has phone numbers and health answers, so do not share it.</p>
          <div className="btns">
            <button className="btn ghost" onClick={() => download(`clients-${stamp}.csv`, clientsCsv(rows), 'text/csv')}>Clients sheet (CSV)</button>
            <button className="btn ghost" disabled={busy} onClick={() => void run(async () => {
              download(`gym-backup-${stamp}.json`, JSON.stringify(await backup(data.gym.id), null, 1), 'application/json')
              track('backup_downloaded')
            })}>{busy ? 'Preparing' : 'Full backup (JSON)'}</button>
          </div>
        </section>
      )}
      <section className="stack">
        <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => void signOut()}>Sign out</button>
        <p className="xs mut">TRCK Gym {VERSION}. Something wrong? Tell Aditya what you tapped and what you saw. Problems are also saved automatically.</p>
      </section>
    </>
  )
}

// ---------------------------------------------------------------- plans

function Plans() {
  const { data } = useGym()
  const [edit, setEdit] = useState<Partial<Plan> | null>(null)
  return (
    <>
      <Top title="Plans" back="more"><button className="btn sm acc" onClick={() => setEdit({ months: 1, days: 0, active: true, sort: data.plans.length + 1 })}>Add plan</button></Top>
      <section>
        <div className="list">{data.plans.map((p) => (
          <button className="item" key={p.id} onClick={() => setEdit(p)}>
            <div className="who"><b className={p.active ? '' : 'strike'}>{p.name}</b><span>{planLength(p.months, p.days)}{p.active ? '' : ' · not on sale'}</span></div>
            <span className="amt">{inr(p.price)}</span>
          </button>
        ))}</div>
        <p className="xs mut" style={{ marginTop: 12 }}>Changing a price only affects new plans. Plans already sold keep their price.</p>
      </section>
      {edit && <PlanSheet plan={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function PlanSheet({ plan, onClose }: { plan: Partial<Plan>; onClose: () => void }) {
  const { data, reload } = useGym()
  const [name, setName] = useState(plan.name ?? '')
  const [months, setMonths] = useState(String(plan.months ?? 0))
  const [days, setDays] = useState(String(plan.days ?? 0))
  const [price, setPrice] = useState(plan.price != null ? String(plan.price) : '')
  const [active, setActive] = useState(plan.active ?? true)
  const [busy, run] = useBusy()
  const m = Number(months)
  const d = Number(days)
  const pr = parseAmount(price)
  const err = !name.trim() ? 'Give the plan a name.' : !Number.isInteger(m) || m < 0 || m > 36 || !Number.isInteger(d) || d < 0 || d > 366 || m + d === 0 ? 'Set months, days, or both.' : pr === null ? 'Type the price in rupees.' : ''
  return (
    <Sheet title={plan.id ? 'Edit plan' : 'Add plan'} onClose={onClose}>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="For example, Quarterly" /></Field>
      <div className="pair">
        <Field label="Months"><input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
        <Field label="Extra days" hint="A 7 day trial is 0 months, 7 days"><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
      </div>
      <Field label="Price in ₹"><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>On sale</span></label>
      {err && <p className="sm mut">{err}</p>}
      <button className="btn acc block" disabled={busy || !!err} onClick={() => void run(async () => {
        await savePlan({ id: plan.id, gym_id: data.gym.id, name: name.trim(), months: m, days: d, price: pr!, active, sort: plan.sort ?? 0 })
        await reload(); toast('Plan saved.'); onClose()
      })}>Save plan</button>
    </Sheet>
  )
}

// ---------------------------------------------------------------- staff

function StaffPage() {
  const { data, reload, userId } = useGym()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'staff' | 'owner'>('staff')
  const [busy, run] = useBusy()
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  return (
    <>
      <Top title="Staff" back="more" />
      <section>
        <div className="list">{data.staff.map((s, i) => (
          <div className="item" key={s.id}>
            <div className="who"><b>{s.name || s.email}</b><span>{s.email} · {s.role === 'owner' ? 'Owner' : 'Staff'} · {s.user_id ? 'has signed in' : 'not signed in yet'}</span></div>
            {i > 0 && s.user_id !== userId && <button className="link" disabled={busy} onClick={() => void run(async () => { await removeStaff(s.id); await reload(); toast('Removed.') })}>Remove</button>}
          </div>
        ))}</div>
      </section>
      <section className="stack">
        <h2>Add someone</h2>
        <p className="sm mut">They sign in with Google using this email. Staff can handle requests, clients and payments. Only owners see money totals and can change prices or void payments.</p>
        <div className="pair">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <Field label="Gmail address"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="choice" role="group" aria-label="Role">
          <button type="button" aria-pressed={role === 'staff'} onClick={() => setRole('staff')}>Staff</button>
          <button type="button" aria-pressed={role === 'owner'} onClick={() => setRole('owner')}>Owner</button>
        </div>
        <button className="btn acc" disabled={busy || !ok} onClick={() => void run(async () => { await addStaff(data.gym.id, email, role, name.trim()); setEmail(''); setName(''); await reload(); toast('Added. They can sign in now.') })}>Add</button>
      </section>
    </>
  )
}

// ---------------------------------------------------------------- message wording

function Templates() {
  const { data, reload } = useGym()
  const [kind, setKind] = useState<TemplateKind>('welcome')
  const [text, setText] = useState(data.gym.templates?.[kind] ?? DEFAULT_TEMPLATES[kind])
  const [busy, run] = useBusy()
  // Reset only when a different message is picked, so a background refresh never wipes unsaved wording.
  useEffect(() => { setText(data.gym.templates?.[kind] ?? DEFAULT_TEMPLATES[kind]) }, [kind])
  const save = (value: string | null) => run(async () => {
    const t = { ...data.gym.templates }
    if (value === null || value.trim() === DEFAULT_TEMPLATES[kind]) delete t[kind]
    else t[kind] = value.trim().slice(0, 1000)
    await saveGym(data.gym.id, { templates: t }); await reload(); toast('Saved.')
  })
  return (
    <>
      <Top title="Messages" back="more" />
      <section className="stack">
        <Field label="Message"><select value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>{TEMPLATE_KINDS.map((k) => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}</select></Field>
        <Field label="Wording" hint={`Blanks you can use: ${TEMPLATE_VARS.map((v) => `{${v}}`).join(' ')}`}><textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} /></Field>
        <div className="btns">
          <button className="btn acc" disabled={busy} onClick={() => void save(text)}>Save</button>
          <button className="btn ghost" disabled={busy} onClick={() => void save(null)}>Go back to the original</button>
        </div>
      </section>
    </>
  )
}

// ---------------------------------------------------------------- gym details

function GymDetails() {
  const { data, reload } = useGym()
  const [name, setName] = useState(data.gym.name)
  const [phone, setPhone] = useState(displayPhone(data.gym.phone))
  const [address, setAddress] = useState(data.gym.address ?? '')
  const [open, setOpen] = useState(data.gym.join_open)
  const [busy, run] = useBusy()
  const p = phone.trim() ? normalizePhone(phone) : null
  const err = !name.trim() ? 'Add the gym name.' : phone.trim() && !p ? 'Use a 10 digit mobile number.' : ''
  return (
    <>
      <Top title="Gym" back="more" />
      <section className="stack">
        <Field label="Gym name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <Field label="Gym phone" hint="Shown to members on their page."><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Address"><textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} /></Field>
        <label className="check"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /><span>Join form is open to new requests</span></label>
        {err && <p className="sm bad">{err}</p>}
        <button className="btn acc" disabled={busy || !!err} onClick={() => void run(async () => { await saveGym(data.gym.id, { name: name.trim(), phone: p, address: address.trim() || null, join_open: open }); await reload(); toast('Saved.') })}>Save</button>
      </section>
    </>
  )
}

// ---------------------------------------------------------------- insights

function InsightsPage() {
  const { data, rows } = useGym()
  const [days, setDays] = useState(30)
  const [ins, setIns] = useState<Insights | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let current = true // a slow answer for an old choice must not overwrite a newer one
    setErr('')
    insights(data.gym.id, days).then((r) => { if (current) setIns(r) }, (e: Error) => { if (current) setErr(e.message) })
    return () => { current = false }
  }, [data.gym.id, days])
  const f = ins ? funnelFrom(ins.counts, ins.visitors) : null
  const c = ins?.counts ?? {}
  const active = rows.filter((r) => !r.client.archived && (r.status.state === 'active' || r.status.state === 'ending')).length
  const signedIn = data.clients.filter((x) => x.user_id).length
  return (
    <>
      <Top title="Insights" back="more" />
      <section className="stack">
        <div className="chips">{[7, 30, 90].map((d) => <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>Last {d} days</button>)}</div>
        {err && <p className="notice bad">{err}</p>}
        {f && <>
          <h2>Join funnel</h2>
          <div className="kv">
            <div><b>{f.viewed}</b><span>opened the form</span></div>
            <div><b>{f.submitted}</b><span>sent it{pct(f.submitted, f.viewed) !== null ? ` · ${pct(f.submitted, f.viewed)}%` : ''}</span></div>
            <div><b>{f.approved}</b><span>approved{pct(f.approved, f.submitted) !== null ? ` · ${pct(f.approved, f.submitted)}%` : ''}</span></div>
          </div>
          {(c.join_failed ?? 0) > 0 && <p className="sm warn">{c.join_failed} tried to send the form and got an error.</p>}
        </>}
      </section>
      <section className="stack">
        <h2>Members</h2>
        <div className="kv">
          <div><b>{active}</b><span>active now</span></div>
          <div><b>{signedIn}</b><span>have signed in</span></div>
          <div><b>{c.client_home_viewed ?? 0}</b><span>member visits to the app</span></div>
        </div>
      </section>
      <section className="stack">
        <h2>Front desk</h2>
        <div className="kv">
          <div><b>{(c.message_copied ?? 0) + (c.message_opened ?? 0)}</b><span>WhatsApp messages</span></div>
          <div><b>{c.payment_added ?? 0}</b><span>payments recorded</span></div>
          <div><b>{c.membership_added ?? 0}</b><span>renewals and new plans</span></div>
        </div>
      </section>
      <section className="stack">
        <h2>App problems</h2>
        {ins && ins.errors.length ? <div className="timeline">{ins.errors.map((e) => (
          <div key={e.id}><em>{fmtDate(e.created_at.slice(0, 10), true)}</em><span className="sm" style={{ wordBreak: 'break-word' }}>{e.message}</span><span className="xs mut">{e.app_version}</span></div>
        ))}</div> : <p className="sm ok">No problems saved.</p>}
        <p className="xs mut">Paste these into Claude with /gym-debug to get them fixed.</p>
      </section>
    </>
  )
}

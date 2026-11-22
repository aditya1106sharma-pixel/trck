// Sign in, the "no access yet" page, and the client's own home.
import { useEffect, useState } from 'react'
import { configured, myHome, signInWithGoogle, signOut, track } from '../api'
import { daysBetween, fmtDate } from '../lib/dates'
import { inr } from '../lib/money'
import { displayPhone } from '../lib/phone'
import { clientStatus, endsInWords, STATE_LABEL } from '../lib/status'
import { METHOD_LABEL, type Home } from '../lib/types'
import { Failed, Loading, useBusy } from '../ui/bits'

export function SignIn() {
  const [busy, run] = useBusy()
  return (
    <div className="page">
      <div className="top"><span className="brand">TRCK <i>Gym</i></span></div>
      <div className="center"><div>
        <h1>Sign in</h1>
        <p className="mut">Gym owners, staff and members sign in with Google. Members see their plan, days left and payments.</p>
        {configured
          ? <button className="btn acc block" disabled={busy} onClick={() => void run(signInWithGoogle)}>{busy ? 'Opening Google' : 'Continue with Google'}</button>
          : <p className="notice">This copy of the app is not connected to its database yet. See docs/gym/setup.md.</p>}
        <p className="xs mut">New to the gym? Ask the front desk for the join link, or scan the QR code at the desk.</p>
      </div></div>
    </div>
  )
}

export function NoAccess({ email, ambiguous }: { email?: string; ambiguous?: boolean }) {
  return (
    <div className="page">
      <div className="top"><span className="brand">TRCK <i>Gym</i></span></div>
      <div className="center"><div>
        <h3>No membership found</h3>
        <p className="mut">
          {ambiguous
            ? `More than one member uses ${email}. Ask the front desk to give each member their own email.`
            : `We could not find a member or staff account for ${email ?? 'this Google account'}. Ask the front desk to add this email to your profile, then sign in again.`}
        </p>
        <button className="btn ghost" onClick={() => void signOut()}>Sign out</button>
      </div></div>
    </div>
  )
}

export function ClientHome() {
  const [home, setHome] = useState<Home | null | undefined>(undefined)
  const [err, setErr] = useState('')
  const [, run] = useBusy()
  const load = () => { setErr(''); myHome().then((h) => { setHome(h); track('client_home_viewed') }, (e: Error) => setErr(e.message)) }
  useEffect(load, [])
  if (err) return <div className="page"><Failed message={err} retry={load} /></div>
  if (home === undefined) return <div className="page"><Loading /></div>
  if (home === null) return <NoAccess />

  const today = home.gym.today
  const s = clientStatus(home.memberships, home.payments, today)
  const m = s.current ?? s.latest
  const total = m ? daysBetween(m.start_date, s.coveredThrough ?? m.end_date) + 1 : 0
  const used = m && s.daysLeft !== null ? Math.min(total, Math.max(0, total - s.daysLeft - 1)) : total
  const first = home.client.full_name.split(/\s+/)[0]

  return (
    <div className="page">
      <div className="top"><span className="brand">{home.gym.name}<i>.</i></span><span className="end sm mut">Hi {first}</span></div>
      <section className="stack">
        <div className="row sp"><h2>Membership</h2>{m && <span className={'pill ' + (s.state === 'active' ? 'ok' : s.state === 'ending' ? 'warn' : s.state === 'expired' ? 'bad' : 'mut')}>{STATE_LABEL[s.state]}</span>}</div>
        {s.state === 'active' || s.state === 'ending' ? <>
          <div className="big">{s.daysLeft}<small>{s.daysLeft === 0 ? 'last day today' : s.daysLeft === 1 ? 'day to go' : 'days to go'}</small></div>
          <div className="rail"><i style={{ width: `${total ? Math.round((used / total) * 100) : 0}%` }} /></div>
          <div className="row sp sm mut"><span>{m!.plan_name} · from {fmtDate(m!.start_date, true)}</span><span>ends {fmtDate(s.coveredThrough)}</span></div>
          {s.state === 'ending' && <p className="notice">Your plan ends {endsInWords(s.daysLeft!)}. Renew at the front desk to keep going.</p>}
        </> : s.state === 'upcoming' ? <p>Your {s.latest!.plan_name} plan starts on {fmtDate(home.memberships.find((x) => x.status === 'active' && x.start_date > today)?.start_date)}.</p>
          : s.state === 'expired' ? <p>Your {m!.plan_name} plan ended on {fmtDate(m!.end_date)}. Renew at the front desk whenever you are ready.</p>
          : <p className="mut">No plan yet. Choose one at the front desk.</p>}
        <div className="kv">
          <div><b className={s.due > 0 ? 'warn' : ''}>{inr(s.due)}</b><span>due</span></div>
          <div><b>{home.memberships.filter((x) => x.status === 'active').length}</b><span>plans so far</span></div>
          <div><b>{inr(home.payments.reduce((t, p) => t + p.amount, 0))}</b><span>paid in total</span></div>
        </div>
      </section>
      <section>
        <header><h2>Payments</h2></header>
        {home.payments.length ? <div className="list">{home.payments.map((p) => (
          <div className="item" key={p.id}>
            <div className="who"><b>{fmtDate(p.paid_on)}</b><span>{METHOD_LABEL[p.method]} · receipt {p.receipt_no}</span></div>
            <span className="amt">{inr(p.amount)}</span>
          </div>
        ))}</div> : <p className="empty">No payments yet.</p>}
      </section>
      <section>
        <header><h2>Plans</h2></header>
        <div className="list">{home.memberships.map((x) => (
          <div className="item" key={x.id}>
            <div className="who"><b className={x.status === 'cancelled' ? 'strike' : ''}>{x.plan_name}</b><span>{fmtDate(x.start_date)} to {fmtDate(x.end_date)}</span></div>
            <span className="amt">{inr(x.price)}</span>
          </div>
        ))}</div>
      </section>
      <section className="stack tight">
        <h2>{home.gym.name}</h2>
        {home.gym.phone && <p className="num" style={{ fontSize: 22 }}>{displayPhone(home.gym.phone)}</p>}
        {home.gym.address && <p className="sm mut">{home.gym.address}</p>}
        <p className="xs mut" style={{ marginTop: 8 }}>Coming later: log your food and workouts here, from TRCK.</p>
        <button className="btn ghost" style={{ justifySelf: 'start', marginTop: 8 }} onClick={() => void run(signOut)}>Sign out</button>
      </section>
    </div>
  )
}

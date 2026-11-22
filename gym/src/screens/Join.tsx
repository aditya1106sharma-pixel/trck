// The public join form at #/join/<gym>. No sign in. The request goes to the owner, who approves it.
import { useEffect, useState } from 'react'
import { joinInfo, submitJoin, track, type JoinInfo } from '../api'
import { todayIn } from '../lib/dates'
import { anyYes, blankJoin, checkStep, GENDERS, GOALS, HEALTH_QUESTIONS, SOURCES, STEPS, toPayload, type Errors, type JoinForm } from '../lib/join'
import { inr } from '../lib/money'
import { Choice, Failed, Field, Loading, useBusy } from '../ui/bits'

const DRAFT = (slug: string) => `trck-gym-join:${slug}`

const DRAFT_HOURS = 3 // the form may be on a shared front desk phone, so an old half filled form is dropped

function readDraft(slug: string): JoinForm {
  try {
    const raw = localStorage.getItem(DRAFT(slug))
    if (raw) {
      const d = JSON.parse(raw) as Partial<JoinForm> & { saved_at?: number }
      if (d.saved_at && Date.now() - d.saved_at < DRAFT_HOURS * 3600000) return { ...blankJoin(), ...d, health: {}, health_note: '', website: '' }
      localStorage.removeItem(DRAFT(slug))
    }
  } catch { /* a broken draft starts fresh */ }
  return blankJoin()
}

export function Join({ slug }: { slug: string }) {
  const [info, setInfo] = useState<JoinInfo | null | undefined>(undefined)
  const [loadErr, setLoadErr] = useState('')
  const [step, setStep] = useState(0)
  const [f, setF] = useState<JoinForm>(() => readDraft(slug))
  const [errs, setErrs] = useState<Errors>({})
  const [sendErr, setSendErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, run] = useBusy()
  const today = todayIn()

  const load = () => {
    setLoadErr('')
    joinInfo(slug).then((i) => { setInfo(i); if (i) track('join_viewed', {}, slug) }, (e: Error) => setLoadErr(e.message))
  }
  useEffect(load, [slug])
  // Health answers are never kept in the draft. Contact and about you details are, for a few hours.
  useEffect(() => {
    const { health: _h, health_note: _n, website: _w, ...keep } = f
    try { localStorage.setItem(DRAFT(slug), JSON.stringify({ ...keep, saved_at: Date.now() })) } catch { /* no storage, no draft */ }
  }, [f, slug])
  useEffect(() => { window.scrollTo(0, 0) }, [step, done])

  const set = <K extends keyof JoinForm>(k: K, v: JoinForm[K]) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })) }

  if (loadErr) return <div className="page"><Failed message={loadErr} retry={load} /></div>
  if (info === undefined) return <div className="page"><Loading /></div>
  if (info === null) return <div className="page"><Failed message="This join link is not right. Ask the gym for the link again." /></div>

  const header = (
    <div className="top"><span className="brand">{info.name}<i>.</i></span><span className="end sm mut">Join</span></div>
  )
  if (!info.open) return <div className="page">{header}<div className="center"><div><h3>Not taking requests</h3><p className="mut">{info.name} is not taking new requests online right now. Please ask at the front desk.</p></div></div></div>
  if (done) {
    return (
      <div className="page">{header}
        <div className="center"><div>
          <h1>Request sent</h1>
          <p>Thanks, {f.full_name.trim().split(/\s+/)[0]}. {info.name} has your details and will message you on WhatsApp at the number you gave.</p>
          <p className="mut sm">Come to the front desk to choose your plan and pay. Once you join, you can sign in with Google here to see your plan{f.email ? ` using ${f.email.trim().toLowerCase()}` : ''}.</p>
        </div></div>
      </div>
    )
  }

  const next = () => {
    const e = checkStep(step, f, today)
    setErrs(e)
    if (Object.keys(e).length) { track('join_step', { step, blocked: true }, slug); return }
    if (step < 2) { setStep(step + 1); track('join_step', { step: step + 1 }, slug); return }
    if (f.website) { setDone(true); return } // a bot filled the hidden field: pretend it worked, send nothing
    setSendErr('')
    void run(async () => {
      try {
        await submitJoin(slug, toPayload(f))
        track('join_submitted', { health_flag: anyYes(f.health) }, slug)
        try { localStorage.removeItem(DRAFT(slug)) } catch { /* fine */ }
        setDone(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Something went wrong.'
        setSendErr(msg)
        track('join_failed', { reason: msg.slice(0, 80) }, slug)
      }
    })
  }

  return (
    <div className="page">
      {header}
      <form className="stack" style={{ paddingTop: 16 }} noValidate onSubmit={(e) => { e.preventDefault(); next() }}>
        <div className="stack tight">
          <div className="steps" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>
          <p className="xs mut">Step {step + 1} of 3 · {STEPS[step]}</p>
          <h1>{step === 0 ? `Join ${info.name}` : STEPS[step]}</h1>
        </div>

        {step === 0 && <>
          <p className="mut">Takes about two minutes. The gym will message you on WhatsApp.</p>
          <Field label="Full name" error={errs.full_name}><input autoComplete="name" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} maxLength={80} /></Field>
          <Field label="Mobile number (WhatsApp)" error={errs.phone}>
            <div className="prefix"><b>+91</b><input type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98765 43210" /></div>
          </Field>
          <Field label="Gmail address (optional)" error={errs.email} hint="Use the Google account you will sign in with to see your plan and payments.">
            <input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
          </Field>
          <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} /></label>
        </>}

        {step === 1 && <>
          <div className="pair">
            <Field label="Date of birth" error={errs.dob}><input type="date" value={f.dob} max={today} onChange={(e) => set('dob', e.target.value)} /></Field>
            <Field label="Gender"><select value={f.gender} onChange={(e) => set('gender', e.target.value)}><option value="">Choose</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></Field>
          </div>
          <div className="field"><span>Main goal</span><Choice label="Main goal" options={GOALS} value={f.goal} onChange={(v) => set('goal', v)} /></div>
          {info.plans.length > 0 && (
            <Field label="Plan you are thinking of" hint="You can change this at the desk.">
              <select value={f.plan_interest} onChange={(e) => set('plan_interest', e.target.value)}>
                <option value="">Not sure yet</option>
                {info.plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.price)}</option>)}
              </select>
            </Field>
          )}
          <div className="pair">
            <Field label="Emergency contact name"><input value={f.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} maxLength={80} /></Field>
            <Field label="Their mobile" error={errs.emergency_phone}><input type="tel" inputMode="tel" value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} /></Field>
          </div>
          <div className="field"><span>How did you hear about us</span><Choice label="How did you hear about us" options={SOURCES} value={f.source} onChange={(v) => set('source', v)} /></div>
        </>}

        {step === 2 && <>
          <p className="mut sm">Seven yes or no questions so the trainers know how to look after you. A yes does not stop you joining.</p>
          <div className="list">
            {HEALTH_QUESTIONS.map((h) => (
              <div className="yn" key={h.key}>
                <span className="sm">{h.q}</span>
                <div className="seg" role="group" aria-label={h.q}>
                  <button type="button" className="yes" aria-pressed={f.health[h.key] === true} onClick={() => set('health', { ...f.health, [h.key]: true })}>Yes</button>
                  <button type="button" aria-pressed={f.health[h.key] === false} onClick={() => set('health', { ...f.health, [h.key]: false })}>No</button>
                </div>
              </div>
            ))}
          </div>
          {errs.health && <p className="field"><span className="err">{errs.health}</span></p>}
          {anyYes(f.health) && (
            <Field label="Tell us a little more (optional)" hint="Please check with a doctor before starting hard training.">
              <textarea value={f.health_note} onChange={(e) => set('health_note', e.target.value)} maxLength={300} />
            </Field>
          )}
          <div>
            <label className="check"><input type="checkbox" checked={f.consent_whatsapp} onChange={(e) => set('consent_whatsapp', e.target.checked)} /><span>{info.name} may message me on WhatsApp about my plan, payments and renewals.</span></label>
            <label className="check"><input type="checkbox" checked={f.consent_terms} onChange={(e) => set('consent_terms', e.target.checked)} /><span>My answers are true. I will follow the gym rules and train at my own risk. {info.name} may keep these details to run my membership.</span></label>
            {errs.consent_terms && <p className="field"><span className="err">{errs.consent_terms}</span></p>}
          </div>
        </>}

        {sendErr && <p className="notice bad" role="alert">{sendErr}</p>}
        <div className="btns">
          {step > 0 && <button type="button" className="btn ghost" onClick={() => { setErrs({}); setStep(step - 1) }}>Back</button>}
          <button className="btn acc" disabled={busy}>{busy ? 'Sending' : step < 2 ? 'Next' : 'Send request'}</button>
        </div>
        <p className="xs mut">Your contact details are kept on this phone for a few hours until you send them. Health answers are not.</p>
      </form>
    </div>
  )
}

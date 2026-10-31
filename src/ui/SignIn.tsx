import { useState } from 'react'

type Props = {
  onSubmit: (e: string, p: string, create: boolean) => Promise<string>
  onReset: (email: string) => Promise<{ ok: boolean; message: string }>
  toast: (m: string) => void
}

export function SignIn({ onSubmit, onReset, toast }: Props) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [forgot, setForgot] = useState(false)
  const [cooling, setCooling] = useState(false) // one reset email a minute, which is also all Supabase allows
  const [busy, setBusy] = useState(false)
  const go = async (create: boolean) => { const m = await onSubmit(email.trim(), pw, create); if (m) toast(m) }
  const sendReset = async () => {
    setBusy(true)
    const r = await onReset(email.trim())
    setBusy(false)
    toast(r.message)
    if (r.ok) { setCooling(true); setTimeout(() => setCooling(false), 60_000) } // a failed send can be tried again at once
  }

  if (forgot) {
    return (
      <div>
        <p className="sm mut" style={{ marginBottom: 12 }}>Type the email you signed up with. We will send a link to choose a new password.</p>
        <label className="f" htmlFor="em">Email</label>
        <input id="em" type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn acc" disabled={!email.includes('@') || cooling || busy} onClick={() => void sendReset()}>{cooling ? 'Link sent' : 'Email me a link'}</button>
          <button className="btn ghost" onClick={() => setForgot(false)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="sm mut" style={{ marginBottom: 12 }}>Sign in once on each device. Your log then follows you.</p>
      <label className="f" htmlFor="em">Email</label>
      <input id="em" type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="f" htmlFor="pw" style={{ marginTop: 10 }}>Password</label>
      <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn acc" disabled={!email || pw.length < 6} onClick={() => void go(false)}>Sign in</button>
        <button className="btn ghost" disabled={!email || pw.length < 6} onClick={() => void go(true)}>Create account</button>
      </div>
      <button className="linkbtn" onClick={() => setForgot(true)}>Forgot password?</button>
    </div>
  )
}

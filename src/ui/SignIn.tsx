import { useState } from 'react'

export function SignIn({ onSubmit, toast }: { onSubmit: (e: string, p: string, create: boolean) => Promise<string>; toast: (m: string) => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const go = async (create: boolean) => { const m = await onSubmit(email.trim(), pw, create); if (m) toast(m) }
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
    </div>
  )
}

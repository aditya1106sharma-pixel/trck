import { useState } from 'react'
import { cleanCode, codeReady } from '../lib/auth'

type Props = {
  onSubmit: (e: string, p: string, create: boolean) => Promise<string>
  onReset: (email: string) => Promise<{ ok: boolean; message: string }>
  onSendCode: (email: string) => Promise<string>
  onVerifyCode: (email: string, code: string) => Promise<string>
  toast: (m: string) => void
}

type Mode = 'code' | 'password' | 'forgot'

export function SignIn({ onSubmit, onReset, onSendCode, onVerifyCode, toast }: Props) {
  const [mode, setMode] = useState<Mode>('code')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false) // a code has been emailed, so ask for it
  const [cooling, setCooling] = useState(false) // one email a minute, which is also about what Supabase allows
  const [busy, setBusy] = useState(false)
  const cool = () => { setCooling(true); setTimeout(() => setCooling(false), 60_000) }

  const go = async (create: boolean) => { const m = await onSubmit(email.trim(), pw, create); if (m) toast(m) }
  const sendReset = async () => {
    setBusy(true)
    const r = await onReset(email.trim())
    setBusy(false)
    toast(r.message)
    if (r.ok) cool() // a failed send can be tried again at once
  }
  const sendCode = async () => {
    setBusy(true)
    const m = await onSendCode(email.trim())
    setBusy(false)
    if (m) { toast(m); return }
    setSent(true); setCode(''); cool()
    toast('Code sent. Check your email, and spam.')
  }
  const verify = async () => {
    setBusy(true)
    const m = await onVerifyCode(email.trim(), code)
    setBusy(false)
    if (m) toast(m) // on success the app signs in and this screen goes away
  }

  const emailField = (
    <>
      <label className="f" htmlFor="em">Email</label>
      <input id="em" type="text" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} disabled={sent && mode === 'code'} onChange={(e) => setEmail(e.target.value)} />
    </>
  )

  if (mode === 'forgot') {
    return (
      <div>
        <p className="sm mut" style={{ marginBottom: 12 }}>Type the email you signed up with. We will send a link to choose a new password.</p>
        {emailField}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn acc" disabled={!email.includes('@') || cooling || busy} onClick={() => void sendReset()}>{cooling ? 'Link sent' : 'Email me a link'}</button>
          <button className="btn ghost" onClick={() => setMode('password')}>Back</button>
        </div>
      </div>
    )
  }

  if (mode === 'password') {
    return (
      <div>
        <p className="sm mut" style={{ marginBottom: 12 }}>Sign in with a password.</p>
        {emailField}
        <label className="f" htmlFor="pw" style={{ marginTop: 10 }}>Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn acc" disabled={!email || pw.length < 6} onClick={() => void go(false)}>Sign in</button>
          <button className="btn ghost" disabled={!email || pw.length < 6} onClick={() => void go(true)}>Create account</button>
        </div>
        <div className="row sp">
          <button className="linkbtn" onClick={() => setMode('forgot')}>Forgot password?</button>
          <button className="linkbtn" onClick={() => setMode('code')}>Use an email code instead</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="sm mut" style={{ marginBottom: 12 }}>No password to remember. We email you a code, you type it here, and your log follows you.</p>
      {emailField}
      {!sent ? (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn acc" disabled={!email.includes('@') || busy} onClick={() => void sendCode()}>Email me a code</button>
        </div>
      ) : (
        <>
          <label className="f" htmlFor="otp" style={{ marginTop: 10 }}>Code from the email</label>
          <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={14} value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="123456" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn acc" disabled={!codeReady(code) || busy} onClick={() => void verify()}>Sign in</button>
            <button className="btn ghost" disabled={cooling || busy} onClick={() => void sendCode()}>{cooling ? 'Code sent' : 'Send a new code'}</button>
          </div>
          <button className="linkbtn" onClick={() => { setSent(false); setCode('') }}>Use a different email</button>
        </>
      )}
      <div><button className="linkbtn" onClick={() => setMode('password')}>Use a password instead</button></div>
    </div>
  )
}

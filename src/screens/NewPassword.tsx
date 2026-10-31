import { useState } from 'react'
import { MIN_PASSWORD, passwordProblem } from '../lib/auth'
import { Section } from '../ui/bits'
import type { ScreenProps } from './common'

/** Shown after someone opens a reset link from their email. */
export function NewPassword({ sync, toast }: Pick<ScreenProps, 'sync' | 'toast'>) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = passwordProblem(pw, again)

  if (sync.recovery === 'expired') {
    return (
      <Section title="Link expired">
        <div className="setup">
          <p>That reset link has expired or was already used. On the sign in screen, tap Forgot password to get a new one.</p>
          <button className="btn acc" onClick={sync.endRecovery}>Back to TRCK</button>
        </div>
      </Section>
    )
  }

  const save = async () => {
    setBusy(true)
    const m = await sync.setNewPassword(pw)
    setBusy(false)
    toast(m || 'Password changed. You are signed in.')
  }

  return (
    <Section title="New password">
      <div className="setup">
        <p className="sm mut">{sync.email ? `For ${sync.email}. ` : ''}Choose a new password. It needs at least {MIN_PASSWORD} characters.</p>
        <div>
          <label className="f" htmlFor="np">New password</label>
          <input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <label className="f" htmlFor="np2">Type it again</label>
          <input id="np2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          {pw && again && problem && <p className="sm" role="status">{problem}</p>}
        </div>
        <button className="btn acc" disabled={!!problem || busy} onClick={() => void save()}>Save new password</button>
        <button className="btn ghost" onClick={sync.endRecovery}>Skip for now</button>
      </div>
    </Section>
  )
}

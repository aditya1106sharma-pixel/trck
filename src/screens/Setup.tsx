import { useState } from 'react'
import { applySetup, proteinFor, PROTEIN_PER_KG, validWeight, WEIGHT_MAX, WEIGHT_MIN } from '../lib/setup'
import { syncAvailable } from '../lib/sync'
import { Section } from '../ui/bits'
import { SignIn } from '../ui/SignIn'
import type { ScreenProps } from './common'

export function Setup({ store, sync, today, toast }: Pick<ScreenProps, 'store' | 'sync' | 'today' | 'toast'>) {
  const [kg, setKg] = useState('')
  const [protein, setProtein] = useState('')
  const [edited, setEdited] = useState(false)
  const [start, setStart] = useState(today)
  const [account, setAccount] = useState(false)
  const p = Number(protein)

  const onWeight = (v: string) => {
    setKg(v)
    if (!edited && validWeight(Number(v))) setProtein(String(proteinFor(Number(v))))
  }

  return (
    <>
      <Section title="Set up">
        <div className="setup">
        <p className="sm mut">Three answers and you are in. You can change them later in Plan.</p>
        <div>
          <label className="f" htmlFor="kg">Body weight in kg</label>
          <input id="kg" type="number" inputMode="decimal" min={WEIGHT_MIN} max={WEIGHT_MAX} value={kg} onChange={(e) => onWeight(e.target.value)} />
        </div>
        <div>
          <label className="f" htmlFor="pt">Daily protein target in g</label>
          <input id="pt" type="number" inputMode="numeric" min="0" value={protein} onChange={(e) => { setEdited(true); setProtein(e.target.value) }} />
          <p className="sm mut">About {PROTEIN_PER_KG} g for each kg of body weight. A rough guide, not medical advice.</p>
        </div>
        <div>
          <label className="f" htmlFor="sd">Start date</label>
          <input id="sd" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <button className="btn acc" disabled={!(p > 0) || !start}
          onClick={() => store.setSettings((s) => applySetup(s, { protein: p, start }))}>Start</button>
        </div>
      </Section>

      {syncAvailable && (
        <Section title="Already use TRCK?">
          {account ? <SignIn onSubmit={sync.signIn} onReset={sync.resetPassword} toast={toast} /> : (
            <div className="setup">
              <p className="sm mut">Sign in to bring your log to this device.</p>
              <button className="btn ghost" onClick={() => setAccount(true)}>Sign in</button>
            </div>
          )}
        </Section>
      )}
    </>
  )
}

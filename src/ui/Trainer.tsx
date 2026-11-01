import { useRef, useState } from 'react'
import { addSets, claudePrompt, demoLink, ensureLift, findLift, parseCoachReply, type Card } from '../lib/coach'
import { buildContext } from '../lib/context'
import { muscleLabel } from '../lib/catalog'
import type { Store } from '../lib/store'
import { uid } from '../screens/common'

type Msg = { id: string; role: 'me' | 'coach'; text?: string; attached?: string; cards?: (Card & { done?: boolean })[] }
const KEY = 'trck:coach' // this phone only. Not synced, and never holds a photo.
const MAX_MSGS = 30

function readThread(): Msg[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((m): m is Msg => !!m && typeof m.id === 'string' && (m.role === 'me' || m.role === 'coach')).slice(-MAX_MSGS) : []
  } catch { return [] }
}
function writeThread(t: Msg[]) { try { localStorage.setItem(KEY, JSON.stringify(t.slice(-MAX_MSGS))) } catch { /* private mode */ } }

type Rec = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; interimResults: boolean }
const SpeechCtor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function Trainer({ store, sel, toast }: { store: Store; sel: string; toast: (m: string) => void }) {
  const { data, mutate, setSettings } = store
  const s = data.settings
  const [thread, setThread] = useState<Msg[]>(readThread)
  const [q, setQ] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const [listening, setListening] = useState(false)
  const rec = useRef<Rec | null>(null)

  const push = (fn: (t: Msg[]) => Msg[]) => setThread((t) => { const n = fn(t).slice(-MAX_MSGS); writeThread(n); return n })
  const context = () => buildContext(data.days, s, sel, Date.now())

  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast(ok) } catch { toast('Could not copy. Try again.') }
  }

  const ask = () => {
    const prompt = claudePrompt(context(), q)
    const attached = files.map((f) => f.name).join(', ')
    // Copy and share in the same tap, so the browser allows both. The photo goes to Claude, never to TRCK.
    void navigator.clipboard?.writeText(prompt).catch(() => {})
    if (files.length && navigator.canShare?.({ files })) {
      navigator.share({ files, text: prompt }).catch(() => {})
      toast('Pick Claude. If the question does not come along, paste it.')
    } else {
      toast(files.length ? 'Question copied. Attach your photo in Claude, then paste.' : 'Question copied. Paste it in Claude.')
    }
    push((t) => [...t, { id: uid(), role: 'me', text: q.trim() || 'Photo or clip', attached: attached || undefined }])
    setQ(''); setFiles([])
  }

  const read = () => {
    const p = parseCoachReply(paste)
    if (!p.ok) { setErr(p.error); return }
    setErr('')
    push((t) => [...t, { id: uid(), role: 'coach', cards: p.cards }])
    if (p.dropped > 0) toast(`${p.dropped} part${p.dropped === 1 ? '' : 's'} of the reply could not be read and were left out.`)
    setPaste('')
  }

  const done = (mid: string, i: number) => push((t) => t.map((m) => (m.id === mid ? { ...m, cards: m.cards?.map((c, j) => (j === i ? { ...c, done: true } : c)) } : m)))

  const act = (mid: string, i: number, c: Card) => {
    if (c.type === 'log') {
      const newId = 'x_' + uid()
      const id = findLift(c.lift, s)?.id ?? newId
      setSettings((x) => { ensureLift(x, c.lift, c.muscles, newId) })
      mutate(sel, (d) => { addSets(d, id, c.sets) })
      toast(`${c.sets.length} set${c.sets.length === 1 ? '' : 's'} logged`)
    } else if (c.type === 'soreness') {
      mutate(sel, (d) => { d.sore = { ...d.sore, [c.muscle]: c.level } })
      toast('Soreness saved. It can delay Ready.')
    } else if (c.type === 'exercise' && c.muscles.length) {
      setSettings((x) => { ensureLift(x, c.name, c.muscles, 'x_' + uid()) })
      toast('Added to your lifts')
    }
    done(mid, i)
  }

  const voice = () => {
    const C = SpeechCtor()
    if (!C) return
    if (listening) { rec.current?.stop(); return }
    const r = new C()
    r.lang = 'en-IN'; r.interimResults = false
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) setQ((v) => (v ? v + ' ' : '') + t) }
    r.onend = () => setListening(false)
    r.onerror = () => { setListening(false); toast('Voice did not work here. Type instead.') }
    rec.current = r; setListening(true)
    try { r.start() } catch { setListening(false) }
  }

  return (
    <section className="trainer">
      <header>
        <h2>Trainer</h2>
        <button className="linkbtn" onClick={() => void copy(context(), 'Your week is copied')}>Copy my week</button>
      </header>
      <p className="sm mut">Ask about a machine, a lift or how you feel. Your week goes with the question. The photo or clip goes to Claude, not to TRCK.</p>

      <label className="f" htmlFor="coach-q" style={{ marginTop: 12 }}>Your question</label>
      <input id="coach-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pec deck, new to me. Fit tonight?" />
      <div className="row wrap" style={{ marginTop: 10 }}>
        <label className="btn ghost filebtn">Photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((a) => [...a, f].slice(-3)); e.target.value = '' }} /></label>
        <label className="btn ghost filebtn">Clip<input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((a) => [...a, f].slice(-3)); e.target.value = '' }} /></label>
        {SpeechCtor() && <button className="btn ghost" aria-pressed={listening} onClick={voice}>{listening ? 'Listening' : 'Voice'}</button>}
        <button className="btn acc grow" disabled={!q.trim() && !files.length} onClick={ask}>Ask Claude</button>
      </div>
      {files.length > 0 && (
        <p className="sm" style={{ marginTop: 8 }}>Ready to send: {files.map((f) => f.name).join(', ')} <button className="linkbtn" onClick={() => setFiles([])}>Remove</button></p>
      )}

      {thread.length > 0 && (
        <div className="thread">
          {thread.map((m) => m.role === 'me' ? (
            <div className="msg me" key={m.id}><p>{m.text}</p>{m.attached && <p className="sm mut">With {m.attached}</p>}</div>
          ) : (
            <div className="msg coach" key={m.id}>
              {m.cards?.map((c, i) => <CardView key={i} c={c} onAct={() => act(m.id, i, c)} />)}
            </div>
          ))}
          <button className="linkbtn" onClick={() => { setThread([]); writeThread([]) }}>Clear the thread</button>
        </div>
      )}

      <label className="f" htmlFor="coach-paste" style={{ marginTop: 14 }}>Claude's reply</label>
      <textarea id="coach-paste" value={paste} onChange={(e) => { setPaste(e.target.value); setErr('') }} placeholder="Paste Claude's reply here" />
      {err && <p className="sm bad" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={!paste.trim()} onClick={read}>Read the reply</button>
      </div>
      <p className="sm mut" style={{ marginTop: 10 }}>Nothing is logged until you tap Log. Soreness and form are not medical advice. Body photos stay on this phone.</p>
    </section>
  )
}

function CardView({ c, onAct }: { c: Card & { done?: boolean }; onAct: () => void }) {
  if (c.type === 'note') return <div className="coachcard"><p>{c.text}</p></div>
  if (c.type === 'advice') {
    const tag = { rest: 'Rest', swap: 'Swap', push: 'Push', info: '' }[c.action]
    return (
      <div className="coachcard">
        <h3>{c.title}{tag && <span className="tag">{tag}</span>}</h3>
        <p>{c.body}</p>
        {c.muscles.length > 0 && <p className="sm mut">{c.muscles.map(muscleLabel).join(', ')}</p>}
      </div>
    )
  }
  if (c.type === 'soreness') {
    return (
      <div className="coachcard">
        <h3>{muscleLabel(c.muscle)}, sore {['', 'a little', 'a lot', 'sharp'][c.level]}</h3>
        {c.note && <p>{c.note}</p>}
        {c.level === 3 && <p className="sm warn">Sharp pain, swelling or pain that does not ease: stop and see a doctor.</p>}
        <div className="row"><button className="btn" disabled={c.done} onClick={onAct}>{c.done ? 'Soreness saved' : 'Save soreness'}</button></div>
      </div>
    )
  }
  if (c.type === 'log') {
    return (
      <div className="coachcard">
        <h3>Log {c.lift}?</h3>
        <p>{c.sets.map((x) => `${x.w} kg x ${x.r}`).join(', ')}</p>
        <p className="sm mut">Counts towards {c.muscles.map(muscleLabel).join(', ')}.</p>
        <div className="row"><button className="btn acc" disabled={c.done} onClick={onAct}>{c.done ? 'Logged' : `Log ${c.sets.length} set${c.sets.length === 1 ? '' : 's'}`}</button></div>
      </div>
    )
  }
  return (
    <div className="coachcard">
      <h3>{c.name}</h3>
      {c.muscles.length > 0 && <p className="sm mut">{c.muscles.map(muscleLabel).join(', ')}</p>}
      {c.summary && <p>{c.summary}</p>}
      {c.cues.length > 0 && <ol className="sm">{c.cues.map((x, i) => <li key={i}>{x}</li>)}</ol>}
      {c.safety && <p className="sm mut">{c.safety}</p>}
      <div className="row wrap">
        {c.muscles.length > 0 && <button className="btn" disabled={c.done} onClick={onAct}>{c.done ? 'In your lifts' : 'Add to my lifts'}</button>}
        <a className="btn ghost" href={demoLink(c.name)} target="_blank" rel="noreferrer">Watch a demo</a>
      </div>
    </div>
  )
}

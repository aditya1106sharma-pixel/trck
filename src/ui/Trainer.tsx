import { useEffect, useRef, useState } from 'react'
import {
  absolutize, applyChanges, claudePrompt, COACH_FAILURE, demoLink, describeChange, ensureLift, history, isChange, parseCoachReply, readCard,
  type Card, type ChangeCard,
} from '../lib/coach'
import { buildContext } from '../lib/context'
import { muscleLabel } from '../lib/catalog'
import { askCoach } from '../lib/sync'
import type { Store } from '../lib/store'
import { uid } from '../screens/common'
import { shrink } from './shrink'
import type { Day } from '../lib/types'

type Stored = Card & { done?: boolean }
type Msg = { id: string; role: 'me' | 'coach'; text?: string; attached?: string; cards?: Stored[]; via?: 'app' | 'paste'; applied?: 'yes' | 'skip' }
const KEY = 'trck:coach' // this phone only. Not synced, and never holds a photo.
const USED = 'trck:coach:used'
const MAX_MSGS = 30

/** Reads the saved thread. Every card goes through the same checks as a reply, so a damaged save cannot blank the screen. */
function readThread(): Msg[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.slice(-MAX_MSGS).flatMap((m: unknown): Msg[] => {
      if (!m || typeof m !== 'object') return []
      const o = m as Record<string, unknown>
      if (typeof o.id !== 'string') return []
      const text = typeof o.text === 'string' ? o.text.slice(0, 1500) : undefined
      if (o.role === 'me') return [{ id: o.id, role: 'me', text: text ?? '', attached: typeof o.attached === 'string' ? o.attached.slice(0, 200) : undefined }]
      if (o.role !== 'coach') return []
      const cards = (Array.isArray(o.cards) ? o.cards : []).flatMap((c: unknown) => { const k = readCard(c); return k ? [{ ...k, done: !!(c as { done?: unknown }).done }] : [] })
      if (!cards.length && !text) return []
      return [{ id: o.id, role: 'coach', text, cards, via: o.via === 'app' ? 'app' : 'paste', applied: o.applied === 'yes' || o.applied === 'skip' ? o.applied : undefined }]
    })
  } catch { return [] }
}
function writeThread(t: Msg[]) { try { localStorage.setItem(KEY, JSON.stringify(t.slice(-MAX_MSGS))) } catch { /* private mode */ } }

type Rec = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; interimResults: boolean }
const SpeechCtor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function readUsed(day: string): { n: number; cap: number } | null {
  try { const v = JSON.parse(localStorage.getItem(USED) ?? 'null'); return v && v.day === day && typeof v.n === 'number' ? { n: v.n, cap: typeof v.cap === 'number' ? v.cap : 20 } : null } catch { return null }
}

export function Trainer({ store, sel, today, toast }: { store: Store; sel: string; today: string; toast: (m: string) => void }) {
  const { data, setSettings, apply } = store
  const s = data.settings
  const [thread, setThread] = useState<Msg[]>(readThread)
  const [q, setQ] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([]) // for the Claude app route only
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const [fail, setFail] = useState('')
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [used, setUsed] = useState(() => readUsed(today))
  const rec = useRef<Rec | null>(null)
  const busy = useRef(new Set<string>()) // a button tapped twice must act once
  const alive = useRef(true)
  const [said, setSaid] = useState('')
  useEffect(() => () => { alive.current = false; rec.current?.stop() }, []) // leaving the tab ends the mic

  const push = (fn: (t: Msg[]) => Msg[]) => setThread((t) => { const n = fn(t).slice(-MAX_MSGS); writeThread(n); return n })
  const context = () => buildContext(data.days, s, today, Date.now())
  const onDay = sel === today ? '' : ` on ${sel}`

  // The conversation, in the app.
  const send = async () => {
    const question = q.trim()
    if (!question && !photo) return
    setFail('')
    const turns = [...history(thread), { role: 'user' as const, text: question || 'What can you tell me about this photo?' }]
    setThinking(true)
    let image: string | undefined
    try { image = photo ? await shrink(photo) : undefined } catch { setThinking(false); setFail('That photo could not be read. Try another.'); return }
    const res = await askCoach({ messages: turns, context: context(), today, image })
    image = undefined
    setThinking(false)
    if (!res.ok) { setFail(COACH_FAILURE[res.why] ?? COACH_FAILURE.failed); return }
    // The function always answers with a JSON object. Anything else is a failure, not a note.
    let shape: unknown = null
    try { shape = JSON.parse(res.text) } catch { /* handled below */ }
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) { setFail(COACH_FAILURE.failed); return }
    const p = parseCoachReply(res.text)
    if (!p.ok || (!p.text && !p.cards.length)) { setFail(COACH_FAILURE.failed); return }
    try {
      const m = JSON.parse(res.text) as { used?: unknown; cap?: unknown }
      if (typeof m.used === 'number') {
        const u = { n: m.used, cap: typeof m.cap === 'number' ? m.cap : 20 }
        setUsed(u)
        try { localStorage.setItem(USED, JSON.stringify({ day: today, ...u })) } catch { /* ignore */ }
      }
    } catch { /* the count is a convenience */ }
    const fresh: Msg[] = [{ id: uid(), role: 'me', text: question || 'A photo', attached: photo?.name }, { id: uid(), role: 'coach', via: 'app', text: p.text, cards: absolutize(p.cards, today, sel) }]
    // The person may have left the tab while it thought. The answer is saved either way.
    if (alive.current) { push((t) => [...t, ...fresh]); setSaid('The trainer replied.') } else writeThread([...readThread(), ...fresh].slice(-MAX_MSGS))
    if (p.dropped > 0) toast(`${p.dropped} part${p.dropped === 1 ? '' : 's'} of the reply could not be read and were left out.`)
    if (alive.current) { setQ(''); setPhoto(null) }
  }

  // Changes the person agreed to. Added to the log, never overwriting it.
  const run = (lock: string, cards: Card[]): { applied: number; skipped: number } | null => {
    if (busy.current.has(lock)) return null
    busy.current.add(lock)
    const count = applyChanges(data, cards, today, sel, Date.now(), () => 'x_' + uid())
    if (count.applied) apply((prev) => applyChanges(prev, cards, today, sel, Date.now(), () => 'x_' + uid()).data)
    return { applied: count.applied, skipped: count.skipped }
  }
  const approve = (m: Msg) => {
    const changes = (m.cards ?? []).filter(isChange)
    const r = run(m.id, changes)
    if (!r) return
    const saved = r.applied > 0
    push((t) => t.map((x) => (x.id === m.id ? { ...x, applied: saved ? 'yes' : 'skip', cards: x.cards?.map((c) => (isChange(c) ? { ...c, done: true } : c)) } : x)))
    toast(!saved ? 'Nothing was saved. The dates looked wrong.' : r.skipped ? `${r.applied} saved. ${r.skipped} skipped, the date looked wrong.` : `${r.applied} change${r.applied === 1 ? '' : 's'} saved`)
    setTimeout(() => document.getElementById(`approve-${m.id}`)?.focus(), 0) // the buttons are gone, so focus moves to the result
  }
  const skip = (m: Msg) => { push((t) => t.map((x) => (x.id === m.id ? { ...x, applied: 'skip' } : x))); setTimeout(() => document.getElementById(`approve-${m.id}`)?.focus(), 0) }

  // One card from a pasted Claude reply.
  const one = (mid: string, i: number, c: Card) => {
    if (c.type === 'exercise') {
      if (!c.muscles.length || busy.current.has(`${mid}:${i}`)) return
      busy.current.add(`${mid}:${i}`)
      setSettings((x) => { ensureLift(x, c.name, c.muscles, 'x_' + uid()) })
      toast('Added to your lifts')
    } else if (isChange(c)) {
      const r = run(`${mid}:${i}`, [c])
      if (!r) return
      toast(r.skipped ? 'Skipped, the date looked wrong.' : `Saved${onDay}`)
    }
    push((t) => t.map((m) => (m.id === mid ? { ...m, cards: m.cards?.map((x, j) => (j === i ? { ...x, done: true } : x)) } : m)))
  }

  // The Claude app route: for clips, or when the free messages run out.
  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast(ok) } catch { toast('Could not copy. Try again.') }
  }
  const viaClaude = () => {
    const prompt = claudePrompt(context(), q)
    const all = [...(photo ? [photo] : []), ...files]
    const copied = navigator.clipboard?.writeText(prompt).then(() => true, () => false) ?? Promise.resolve(false)
    void copied.then((ok) => { if (!ok) toast('Could not copy the question. Use Copy my week and type your question in Claude.') })
    if (all.length && navigator.canShare?.({ files: all })) {
      navigator.share({ files: all, text: prompt }).catch(() => {})
      toast('Pick Claude. If the question does not come along, paste it.')
    } else toast(all.length ? 'Question copied. Attach your photo in Claude, then paste.' : 'Question copied. Paste it in Claude.')
    push((t) => [...t, { id: uid(), role: 'me', text: q.trim() || 'Photo or clip', attached: all.map((f) => f.name).join(', ') || undefined }])
    setQ(''); setPhoto(null); setFiles([]); setFail('')
  }
  const read = () => {
    const p = parseCoachReply(paste)
    if (!p.ok) { setErr(p.error); return }
    setErr('')
    push((t) => [...t, { id: uid(), role: 'coach', via: 'paste', text: p.text, cards: absolutize(p.cards, today, sel) }])
    if (p.dropped > 0) toast(`${p.dropped} part${p.dropped === 1 ? '' : 's'} of the reply could not be read and were left out.`)
    setPaste('')
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
        <span className="sm mut">{used ? `${used.n} of ${used.cap} AI messages today` : 'Free AI messages: 20 a day'}</span>
      </header>
      <p className="sm mut">Say what you did, ask about a machine, or tell it how you feel. It knows your week. It proposes changes and nothing is saved until you agree.</p>

      <form onSubmit={(e) => { e.preventDefault(); if (!thinking) void send() }}>
        <label className="f" htmlFor="coach-q" style={{ marginTop: 12 }}>Message</label>
        <input id="coach-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Yesterday I did leg press, 3 sets of 10 at 60" />
        <div className="row wrap" style={{ marginTop: 10 }}>
          <label className="btn ghost filebtn">Photo<input id="coach-photo" type="file" accept="image/*" className="vh" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f); e.target.value = '' }} /></label>
          {SpeechCtor() && <button type="button" className="btn ghost" aria-pressed={listening} onClick={voice}>Voice</button>}
          <button type="submit" className="btn acc grow" disabled={thinking || (!q.trim() && !photo)}>{thinking ? 'Thinking' : 'Send'}</button>
        </div>
      </form>
      {photo && <p className="sm" style={{ marginTop: 8 }}>Photo ready: {photo.name} <button className="linkbtn" onClick={() => setPhoto(null)}>Remove</button></p>}
      <p className="vh" role="status" aria-live="polite">{said}</p>
      {fail && (
        <div role="alert" className="failbox">
          <p className="sm">{fail}</p>
          <button className="linkbtn" onClick={viaClaude} disabled={!q.trim() && !photo}>Send it to the Claude app instead</button>
        </div>
      )}

      {thread.length > 0 && (
        <div className="thread">
          {thread.map((m) => m.role === 'me' ? (
            <div className="msg me" key={m.id}><p>{m.text}</p>{m.attached && <p className="sm mut">With {m.attached}</p>}</div>
          ) : (
            <Coach key={m.id} m={m} today={today} sel={sel} days={data.days} onApprove={() => approve(m)} onSkip={() => skip(m)} onOne={(i, c) => one(m.id, i, c)} />
          ))}
          <button className="linkbtn" onClick={() => { setThread([]); writeThread([]) }}>Clear the conversation</button>
        </div>
      )}

      <p className="sm mut" style={{ marginTop: 10 }}>A photo goes to Google Gemini to answer. On the free plan Google may use it to improve its models. TRCK keeps no copy. Body photos stay on this phone. Not medical advice.</p>

      <details className="claudebox">
        <summary>Use the Claude app instead</summary>
        <p className="sm mut">For a clip, or when the free messages run out. Your week and question are copied, and your photo or clip goes to Claude through the share sheet. Paste its reply below.</p>
        <div className="row wrap" style={{ margin: '10px 0' }}>
          <label className="btn ghost filebtn">Clip<input type="file" accept="video/*" className="vh" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((a) => [...a, f].slice(-3)); e.target.value = '' }} /></label>
          <button className="btn ghost" disabled={!q.trim() && !photo && !files.length} onClick={viaClaude}>Send to the Claude app</button>
          <button className="linkbtn" onClick={() => void copy(context(), 'Your week is copied')}>Copy my week</button>
        </div>
        {files.length > 0 && <p className="sm">Ready to send: {files.map((f) => f.name).join(', ')} <button className="linkbtn" onClick={() => setFiles([])}>Remove</button></p>}
        <label className="f" htmlFor="coach-paste">Claude's reply</label>
        <textarea id="coach-paste" value={paste} onChange={(e) => { setPaste(e.target.value); setErr('') }} placeholder="Paste Claude's reply here" />
        {err && <p className="sm bad" role="alert">{err}</p>}
        <div className="row" style={{ marginTop: 10 }}><button className="btn" disabled={!paste.trim()} onClick={read}>Read the reply</button></div>
      </details>
      <p className="sm mut" style={{ marginTop: 8 }}>Voice uses your browser's own speech service, which may send audio to its maker.</p>
    </section>
  )
}

function Coach({ m, today, sel, days, onApprove, onSkip, onOne }: { m: Msg; today: string; sel: string; days: Record<string, Day>; onApprove: () => void; onSkip: () => void; onOne: (i: number, c: Card) => void }) {
  const cards = m.cards ?? []
  const inApp = m.via === 'app'
  const changes = cards.filter(isChange) as ChangeCard[]
  const sharp = changes.some((c) => c.type === 'soreness' && c.level === 3)
  return (
    <div className="msg coach">
      {m.text && <div className="coachcard"><p>{m.text}</p></div>}
      {cards.map((c, i) => (inApp && isChange(c)) ? null : <CardView key={i} c={c} onAct={() => onOne(i, c)} />)}
      {inApp && changes.length > 0 && (
        <div className="coachcard approve">
          <h3 id={`approve-${m.id}`} tabIndex={-1}>{m.applied === 'yes' ? 'Changes saved' : m.applied === 'skip' ? 'Changes skipped' : `I want to make ${changes.length} change${changes.length === 1 ? '' : 's'}`}</h3>
          <ul className="plain">{changes.map((c, i) => <li key={i}>{describeChange(c, today, sel, days)}</li>)}</ul>
          {sharp && <p className="sm warn">Sharp pain, swelling or pain that does not ease: stop and see a doctor.</p>}
          {!m.applied && (
            <>
              <div className="row"><button className="btn acc" onClick={onApprove}>Agree and apply</button><button className="btn ghost" onClick={onSkip}>Skip</button></div>
              <p className="sm mut">Nothing is saved until you agree.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CardView({ c, onAct }: { c: Stored; onAct: () => void }) {
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
  if (c.type === 'measure') {
    return (
      <div className="coachcard">
        <h3>Save {{ wt: 'weight', waist: 'waist', chest: 'chest', arm: 'arm', thigh: 'thigh', hip: 'hip' }[c.key]} {c.value} {c.key === 'wt' ? 'kg' : 'cm'}?</h3>
        <div className="row"><button className="btn" disabled={c.done} onClick={onAct}>{c.done ? 'Saved' : 'Save'}</button></div>
      </div>
    )
  }
  if (c.type === 'diary') {
    return (
      <div className="coachcard">
        <h3>Add a note?</h3>
        <p>{c.text}</p>
        <div className="row"><button className="btn" disabled={c.done} onClick={onAct}>{c.done ? 'Added' : 'Add note'}</button></div>
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

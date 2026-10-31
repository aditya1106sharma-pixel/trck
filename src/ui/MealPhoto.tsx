import { useEffect, useRef, useState } from 'react'
import {
  applyMine, claudePrompt, defaultName, FAILURE_TEXT, fitSize, mealRange, parseReply, photoEntry,
  type Failure, type PhotoPart,
} from '../lib/photo'
import { readMealPhoto } from '../lib/sync'
import type { Food, FoodEntry, Part } from '../lib/types'
import { Stepper, f0 } from './bits'

type Stage =
  | { k: 'start' }
  | { k: 'reading' }
  | { k: 'review'; parts: PhotoPart[]; questions: string[]; fatTsp: number; dropped: string[] }
  | { k: 'fallback'; why: Failure | 'paste' }

/** Draws the photo at most 1024 px on its long side and returns JPEG base64. Nothing is written to storage. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const { w, h } = fitSize(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const url = c.toDataURL('image/jpeg', 0.8)
  c.width = c.height = 0
  return url.slice(url.indexOf(',') + 1)
}

export const PRIVACY_LINE = 'Your photo goes to Google Gemini to be read. On the free plan Google may use it to improve its models, and people at Google may see it. TRCK keeps no copy.'

export function MealPhoto({ foods, onLog, onClose, toast }: {
  foods: Food[]
  onLog: (e: FoodEntry, favourite: { n: string; parts: Part[] } | null) => void
  onClose: () => void
  toast: (m: string) => void
}) {
  const [stage, setStage] = useState<Stage>({ k: 'start' })
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [fav, setFav] = useState(false)
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const head = useRef<HTMLHeadingElement>(null)
  // When the reading finishes the buttons vanish, so move focus to the result instead of losing it.
  useEffect(() => { if (stage.k === 'review') head.current?.focus() }, [stage.k])

  const review = (text: string): string => {
    const r = parseReply(text)
    if (!r.ok) return r.error
    const parts = applyMine(r.reply.parts, foods)
    setName(defaultName(parts))
    setStage({ k: 'review', parts, questions: r.reply.questions, fatTsp: r.reply.fatTsp, dropped: r.reply.dropped })
    return ''
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // drop the reference to the photo at once
    if (!file) return
    setStage({ k: 'reading' })
    let image = ''
    try { image = await shrink(file) } catch { setStage({ k: 'fallback', why: 'failed' }); return }
    const res = await readMealPhoto(image, note)
    image = ''
    if (!res.ok) { setStage({ k: 'fallback', why: res.why }); return }
    const err = review(res.text)
    if (err) setStage({ k: 'fallback', why: 'failed' })
  }

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(claudePrompt(note)); toast('Copied. Paste it into Claude with the photo.') } catch { setShowPrompt(true); toast('Copy it from the box below') }
  }

  if (stage.k === 'review') {
    const { parts, fatTsp } = stage
    const range = mealRange(parts, fatTsp)
    const setQ = (i: number, q: number) => setStage({ ...stage, parts: parts.map((x, j) => (j === i ? { ...x, q } : x)) })
    const kept = parts.filter((x) => x.q > 0)
    return (
      <div className="sheet photo">
        <h3 className="range" ref={head} tabIndex={-1} aria-live="polite">About <b>{range.lo}</b> to <b>{range.hi}</b> kcal</h3>
        <p className="range-p"><span className="num">{range.p}</span> g protein</p>
        <p className="sm mut">Rough numbers from a photo. Check each item before you log it.</p>

        <div className="item fatq">
          <div className="t"><b>How much oil, ghee or butter went in?</b><small>Teaspoons, about 40 kcal each. Count mayo, cream or a buttery sauce as 1 to 2.</small></div>
          <Stepper label="Oil, ghee or butter teaspoons" value={fatTsp} step={0.5} max={10} onChange={(v) => setStage({ ...stage, fatTsp: v })} />
        </div>

        <div className="list">
          {parts.map((x, i) => (
            <div className={'item' + (x.q === 0 ? ' gone' : '')} key={i}>
              <div className="t">
                <b>{x.n}</b>
                <small>{x.u}, {f0(x.p * x.q)} g protein, {f0(x.k * x.q)} kcal{x.mine ? ', your values' : x.conf < 0.5 ? ', rough guess' : ''}</small>
              </div>
              <Stepper label={x.n} value={x.q} step={0.5} max={20} onChange={(v) => setQ(i, v)} />
            </div>
          ))}
        </div>
        {stage.questions.length > 0 && (
          <div className="asks">
            <p className="sm"><b>Also worth checking</b></p>
            <ul className="plain sm">{stage.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        )}
        {stage.dropped.length > 0 && <p className="sm mut">Left out, the numbers did not look real: {stage.dropped.join(', ')}. Add them by hand if you ate them.</p>}

        <label className="f" htmlFor="photo-name" style={{ marginTop: 14 }}>Meal name</label>
        <input id="photo-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="row sm tick"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> Also save as a favourite meal</label>
        <div className="row bar">
          <button className="btn acc grow" disabled={!kept.length} onClick={() => {
            const e = photoEntry(Math.random().toString(36).slice(2, 9), name, parts, fatTsp)
            onLog(e, fav ? { n: e.n, parts: e.parts ?? [] } : null)
          }}>Log meal</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet photo">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={library} type="file" accept="image/*" hidden onChange={onFile} />
      <label className="f" htmlFor="photo-note">What is in it? Optional, it helps</label>
      <input id="photo-note" type="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="chicken, 2 rotis, little oil" />

      {stage.k === 'fallback' ? (
        <div className="fallback">
          {stage.why !== 'paste' && <p className="sm" role="status">{FAILURE_TEXT[stage.why]} You can still log it with Claude.</p>}
          <ol className="plain sm steps">
            <li>Copy the prompt and paste it into Claude with your photo.</li>
            <li>Answer its questions, then paste its reply below.</li>
          </ol>
          <button className="btn acc wide" onClick={copyPrompt}>Copy a prompt for Claude</button>
          {showPrompt && <pre className="prompt" style={{ marginTop: 10 }}>{claudePrompt(note)}</pre>}
          <label className="f" htmlFor="photo-paste" style={{ marginTop: 14 }}>Claude's reply</label>
          <textarea id="photo-paste" value={paste} onChange={(e) => { setPaste(e.target.value); setPasteError('') }} placeholder='{"items": [...]}' />
          {pasteError && <p className="sm bad" role="alert">{pasteError}</p>}
          <div className="row bar">
            <button className="btn ghost grow" disabled={!paste.trim()} onClick={() => setPasteError(review(paste))}>Read the reply</button>
            <button className="btn ghost" onClick={() => setStage({ k: 'start' })}>Back</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row bar">
            <button className="btn acc grow" disabled={stage.k === 'reading'} onClick={() => camera.current?.click()}>{stage.k === 'reading' ? 'Reading the photo' : 'Take photo'}</button>
            <button className="btn ghost grow" disabled={stage.k === 'reading'} onClick={() => library.current?.click()}>Choose photo</button>
          </div>
          <p className="sm mut privacy">{PRIVACY_LINE}</p>
          <div className="row sp">
            <button className="linkbtn" onClick={() => setStage({ k: 'fallback', why: 'paste' })}>Use Claude instead</button>
            <button className="linkbtn" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </div>
  )
}

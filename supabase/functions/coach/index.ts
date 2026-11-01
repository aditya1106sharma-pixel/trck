// The trainer chat. One Gemini call per message, JSON back: a short reply plus cards, some of which propose changes to the log.
// The app shows the changes and applies them only after the person agrees. The photo, if any, is not stored or logged.
// One file on purpose, so it can be pasted into the Supabase editor. Secrets: GEMINI_API_KEY (required), GEMINI_MODEL,
// ALLOWED_ORIGIN, ALLOWED_USERS (optional). It shares the daily counter with meal-photo, because Google's free quota is one pool.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const MODEL = 'gemini-2.5-flash-lite' // used when the GEMINI_MODEL secret is not set
const CAP = 20 // messages and photos a person can use a day, together. Google's free limit is about 20 a day for the whole project.
const MAX_IMAGE_CHARS = 1_500_000
const MAX_CONTEXT = 6_000

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MUSCLES = 'chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core'

const system = (today: string, context: string) => `You are the strength trainer inside a personal gym log for one person in India. He is a beginner doing body recomposition (skinny fat): build muscle and lose fat together on a high protein diet. Today is ${today}.
Talk like a calm, practical coach. Short plain sentences, at most about 120 words in "reply". No emoji, no lists unless asked, no dashes used as asides.
Use his week below. Cite it ("you did 6 sets of back on Friday"). If something is not in his week, do not make it up.

His week:
${context}

How you work:
- When he says what he did, propose it as a "log" card. NEVER invent weights, reps, sets or dates. If numbers are missing, ask one short question in "reply" and add no log card. If he says he trained legs but gives no numbers, ask for them.
- Dates in cards are YYYY-MM-DD, or "today" or "yesterday". Use the date he means.
- Muscle ids you may use: ${MUSCLES}. Traps count as back or shoulders.
- Soreness he mentions becomes a "soreness" card (level 1 a little, 2 a lot, 3 sharp). Body measurements he gives become "measure" cards (key: wt, waist, chest, arm, thigh, hip; weight in kg, others in cm). Something worth remembering becomes a "diary" card.
- Nothing is saved until he agrees. Say plainly in "reply" what you are proposing, then the cards carry it. Do not say it is already done.
- For a machine or lift he asks about, give an "exercise" card: what it trains, 2 or 3 short cues, one safety line. Link nothing. Say what fits his week: ready muscles, what to rest, what to push, and a target from his last numbers.
- You can describe what you see in a photo, but you cannot judge his form with certainty. Never say his form is right or wrong. For heavy compound lifts suggest filming from the side and asking a person.
- Sharp pain, swelling, or pain that does not ease: tell him to stop and see a doctor. This is not medical advice. Do not diagnose.
- Nutrition numbers are rough. Make no health claims.
Reply with JSON only.`

const CARD = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['exercise', 'advice', 'log', 'soreness', 'measure', 'diary', 'note'] },
    name: { type: 'STRING' }, summary: { type: 'STRING' }, cues: { type: 'ARRAY', items: { type: 'STRING' } }, safety: { type: 'STRING' },
    title: { type: 'STRING' }, body: { type: 'STRING' }, action: { type: 'STRING', enum: ['rest', 'swap', 'push', 'info'] },
    lift: { type: 'STRING' }, muscles: { type: 'ARRAY', items: { type: 'STRING' } },
    sets: { type: 'ARRAY', items: { type: 'OBJECT', properties: { w: { type: 'NUMBER' }, r: { type: 'NUMBER' } }, required: ['w', 'r'] } },
    muscle: { type: 'STRING' }, level: { type: 'INTEGER' }, note: { type: 'STRING' },
    key: { type: 'STRING', enum: ['wt', 'waist', 'chest', 'arm', 'thigh', 'hip'] }, value: { type: 'NUMBER' },
    text: { type: 'STRING' }, day: { type: 'STRING' },
  },
  required: ['type'],
}
const SCHEMA = { type: 'OBJECT', properties: { reply: { type: 'STRING' }, cards: { type: 'ARRAY', items: CARD } }, required: ['reply', 'cards'] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method' })
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json(503, { error: 'no-key' })

  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: who, error: authError } = await asUser.auth.getUser()
  if (authError || !who.user) return json(401, { error: 'signed-out' })
  const guests = (Deno.env.get('ALLOWED_USERS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (guests.length && !guests.includes(who.user.id)) return json(403, { error: 'not-allowed' })

  let body: { messages?: unknown; context?: unknown; today?: unknown; image?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'bad-request' }) }
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : ''
  const context = typeof body.context === 'string' ? body.context.slice(0, MAX_CONTEXT) : ''
  const raw = (Array.isArray(body.messages) ? body.messages : []).slice(-10).flatMap((m: unknown) => {
    const o = m as { role?: unknown; text?: unknown }
    return (o?.role === 'user' || o?.role === 'model') && typeof o.text === 'string' && o.text.trim() ? [{ role: o.role as 'user' | 'model', text: o.text.slice(0, 800) }] : []
  })
  // Gemini wants the person first and the sides taking turns, so tidy that here and never spend a message on a 400.
  while (raw.length && raw[0].role === 'model') raw.shift()
  const turns = raw.reduce<{ role: 'user' | 'model'; text: string }[]>((out, t) => {
    const last = out[out.length - 1]
    if (last && last.role === t.role) last.text = (last.text + '\n' + t.text).slice(0, 1600)
    else out.push({ ...t })
    return out
  }, [])
  if (!today || !turns.length || turns[turns.length - 1].role !== 'user') return json(400, { error: 'bad-request' })
  const image = typeof body.image === 'string' ? body.image : ''
  if (image && (image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image))) return json(400, { error: 'bad-image' })

  // The daily count, shared with meal photos, kept in the database so it holds across devices.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: used, error: capError } = await admin.rpc('bump_photo_quota', { p_user: who.user.id, p_cap: CAP })
  if (capError) return json(500, { error: 'quota' })
  if (typeof used !== 'number' || used < 0) return json(429, { error: 'cap', cap: CAP })

  const contents = turns.map((t, i) => ({
    role: t.role,
    parts: i === turns.length - 1 && image
      ? [{ text: t.text }, { inlineData: { mimeType: 'image/jpeg', data: image } }]
      : [{ text: t.text }],
  }))
  const model = Deno.env.get('GEMINI_MODEL') || MODEL
  let r: Response
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system(today, context) }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1800, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
      signal: AbortSignal.timeout(28_000),
    })
  } catch {
    return json(504, { error: 'model-timeout' })
  }
  if (r.status === 429) return json(429, { error: 'cap', cap: CAP }) // Google's own limit
  if (!r.ok) return json(502, { error: 'model', status: r.status })
  const out = await r.json().catch(() => null)
  const text: string = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    const reply = JSON.parse(text)
    if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return json(502, { error: 'bad-json' })
    return json(200, { reply: typeof reply.reply === 'string' ? reply.reply : '', cards: Array.isArray(reply.cards) ? reply.cards : [], used, cap: CAP })
  } catch {
    return json(502, { error: 'bad-json' })
  }
})

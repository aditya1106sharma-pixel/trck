// Reads one meal photo with Gemini and returns JSON only. Runs as a Supabase Edge Function (Deno).
// The photo is never stored or logged. The Gemini key lives only in this function's secrets.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { CAP, MAX_IMAGE_CHARS, MODEL } from './config.ts'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `You read photos of meals for a personal food log in India. The numbers are rough and are not medical advice.
List every separate food or ingredient you can see as its own item, never one total for the plate.
For each item give the cooked weight in grams, the count if it comes in pieces (rotis, eggs, idlis), protein, fat and carbs in grams for that weight, kcal, and your confidence from 0 to 1.
Use Indian names and household units where usual (roti, katori of dal, ladle of rice). For dal, sabzi or curry, list the main ingredient and the gravy separately when you can.
Do not list cooking oil, ghee or butter as items. Put your best guess of the teaspoons used in fat_tsp, and leave that added fat out of each item's fat and kcal so it is not counted twice. Photos hide fat, so do not guess low.
In questions, ask up to 3 short questions whose answers would change the numbers most, such as hidden sauces, the cut of meat, or how many pieces.
The user's note beats the photo. Reply with JSON only.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, grams: { type: 'NUMBER' }, count: { type: 'INTEGER' },
          protein: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' }, confidence: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'protein', 'fat', 'carbs', 'kcal', 'confidence'],
      },
    },
    questions: { type: 'ARRAY', items: { type: 'STRING' } },
    fat_tsp: { type: 'NUMBER' },
  },
  required: ['items', 'questions', 'fat_tsp'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method' })
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json(503, { error: 'no-key' })

  // 1. Who is asking. Supabase also checks the token before this code runs.
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: who, error: authError } = await asUser.auth.getUser()
  if (authError || !who.user) return json(401, { error: 'signed-out' })
  // Optional guest list. Sign ups are open, so set ALLOWED_USERS (comma separated user ids) to keep strangers off the shared free quota.
  const guests = (Deno.env.get('ALLOWED_USERS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (guests.length && !guests.includes(who.user.id)) return json(403, { error: 'not-allowed' })

  // 2. What they sent. Only a JPEG as base64 and a short note.
  let body: { image?: unknown; note?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'bad-request' }) }
  const image = typeof body.image === 'string' ? body.image : ''
  const note = typeof body.note === 'string' ? body.note.slice(0, 300) : ''
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return json(400, { error: 'bad-image' })

  // 3. The daily cap, counted in the database so it holds across devices.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: used, error: capError } = await admin.rpc('bump_photo_quota', { p_user: who.user.id, p_cap: CAP })
  if (capError) return json(500, { error: 'quota' })
  if (typeof used !== 'number' || used < 0) return json(429, { error: 'cap', cap: CAP })

  // 4. Ask Gemini for JSON in our shape.
  const model = Deno.env.get('GEMINI_MODEL') || MODEL
  let r: Response
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [
          { text: note ? `My note: ${note}` : 'No note.' },
          { inlineData: { mimeType: 'image/jpeg', data: image } },
        ] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    return json(504, { error: 'model-timeout' })
  }
  if (!r.ok) return json(502, { error: 'model', status: r.status })
  const out = await r.json().catch(() => null)
  const text: string = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    const parsed = JSON.parse(text)
    return json(200, { ...parsed, used, cap: CAP })
  } catch {
    return json(502, { error: 'bad-json' })
  }
})

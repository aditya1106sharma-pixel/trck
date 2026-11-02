// TRCK-SYNC v1 on the command line. Works on the JSON backup file from Plan, Download backup (default my-data.json).
//   npm run sync:export -- [--days N] [--file my-data.json]
//   npm run sync:import -- [--file my-data.json] [--in pasted.txt] [--dry-run]
//   npm run sync:brief -- [--days N] [--file my-data.json] [--out trck-brief.txt]

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { chatBrief } from '../src/lib/brief'
import { todayKey } from '../src/lib/dates'
import { exportJson, parseImport } from '../src/lib/store'
import { applyImport, describePlan, exportSync, HEADER, parseSync, planImport } from '../src/lib/tracksync'
import type { AppData } from '../src/lib/types'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const cmd = argv[0]
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const flag = (name: string) => argv.includes(name)
const file = resolve(opt('--file') ?? 'my-data.json')

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

function load(): AppData {
  if (!existsSync(file)) fail(`No data file at ${file}. In TRCK open Plan, tap Download backup, save it as my-data.json here, or pass --file <path>.`)
  try { return parseImport(readFileSync(file, 'utf8')) } catch (e) { fail(`Could not read ${file}: ${e instanceof Error ? e.message : e}`) }
}

function daysOpt(def: number): number {
  const raw = opt('--days')
  const n = raw === undefined ? def : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 366) fail('--days must be a whole number from 1 to 366.')
  return n
}

function runExport() {
  console.log('```text\n' + exportSync(load(), daysOpt(2)) + '\n```')
}

/** Everything a chat needs to plan today, saved to a file and printed. */
function runBrief() {
  const now = Date.now()
  const text = chatBrief(load(), todayKey(now), now, daysOpt(7))
  const out = resolve(opt('--out') ?? join(dirname(file), 'trck-brief.txt'))
  writeFileSync(out, text + '\n')
  console.log(text)
  console.error(`\nSaved to ${out}. Paste all of it into a new Claude chat, or attach the file.`)
}

async function runImport() {
  const data = load()
  const rl = createInterface({ input: process.stdin, terminal: false })
  const lines = rl[Symbol.asyncIterator]()
  const next = async (q: string): Promise<string | null> => {
    if (q) process.stdout.write(q)
    const r = await lines.next()
    return r.done ? null : String(r.value)
  }

  let text: string
  if (opt('--in')) text = readFileSync(resolve(opt('--in')!), 'utf8')
  else {
    console.log(`Paste the ${HEADER} text, then press Enter on an empty line.`)
    const got: string[] = []
    for (;;) {
      const l = await next('')
      if (l === null || (l.trim() === '' && got.some((x) => x.trim()))) break
      got.push(l)
    }
    text = got.join('\n')
  }

  const parsed = parseSync(text, data.settings)
  if (!parsed.ok) {
    rl.close()
    fail(['Nothing was imported. Fix these and paste again:', ...parsed.errors.map((e) => '  ' + e)].join('\n'))
  }
  const plan = planImport(data, parsed.days)
  console.log('\nDry run, nothing written yet:')
  for (const l of describePlan(plan)) console.log(l)
  if (flag('--dry-run') || (!plan.adds.length && !plan.conflicts.length)) { rl.close(); return }

  const take = new Set<string>()
  if (plan.conflicts.length) console.log('\nFor each difference, type t to keep TRCK or p to use the pasted value. Enter keeps TRCK.')
  for (const [i, c] of plan.conflicts.entries()) {
    for (;;) {
      const a = (await next(`  ${i + 1}. ${c.date} ${c.field}: t "${c.trck}" or p "${c.pasted}"? `))?.trim().toLowerCase() ?? ''
      if (a === 'p') { take.add(c.id); break }
      if (a === '' || a === 't') break
      console.log('    Type t or p.')
    }
  }
  const result = applyImport(data, plan, take)
  if (!result.changed.length) { rl.close(); console.log('\nNothing to write: every difference keeps TRCK.'); return }
  const yes = (await next(`\nWrite ${plan.adds.length} addition(s) and ${take.size} change(s) to ${basename(file)} for ${result.changed.join(', ')}? Type y to write: `))?.trim().toLowerCase()
  rl.close()
  if (yes !== 'y' && yes !== 'yes') { console.log('Nothing written.'); return }

  const dir = join(dirname(file), 'trck-backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = join(dir, `${basename(file, '.json')}-${stamp}.json`)
  copyFileSync(file, backup)
  const tmp = file + '.tmp'
  writeFileSync(tmp, exportJson(result.data))
  renameSync(tmp, file)
  console.log(`Written. Backup of the old file: ${backup}`)
  console.log('To see it in the app: Plan, Restore or import, choose this file.')
}

if (cmd === 'export') runExport()
else if (cmd === 'brief') runBrief()
else if (cmd === 'import') await runImport()
else fail('Use: export [--days N] [--file my-data.json], brief [--days N] [--out file], or import [--file my-data.json] [--in pasted.txt] [--dry-run]')

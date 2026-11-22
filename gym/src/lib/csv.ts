// A clients sheet the owner can open in Excel or Google Sheets.
import { fmtDate } from './dates'
import { displayPhone } from './phone'
import { STATE_LABEL, type Row } from './status'

/** One cell. Quotes when needed, and a leading = + - @ is made safe so a spreadsheet never runs it as a formula. */
export function cell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function clientsCsv(rows: Row[]): string {
  const head = ['Name', 'Phone', 'Email', 'Status', 'Plan', 'Covered till', 'Due (Rs)', 'Goal', 'Joined', 'Archived']
  const body = rows.map(({ client: c, status: s }) => [
    c.full_name, displayPhone(c.phone), c.email, STATE_LABEL[s.state], (s.current ?? s.latest)?.plan_name, s.coveredThrough ? fmtDate(s.coveredThrough) : '',
    s.due, c.goal, fmtDate(c.created_at.slice(0, 10)), c.archived ? 'Yes' : 'No',
  ].map(cell).join(','))
  return [head.join(','), ...body].join('\r\n') + '\r\n'
}

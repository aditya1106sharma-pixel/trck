// WhatsApp message templates. The app fills them in, the owner copies or opens WhatsApp and presses send.
// No WhatsApp API, so no cost and no Meta approval. Owners can change the wording under More, Messages.
import { fmtDate } from './dates'
import { inr } from './money'
import { dueOn, endsInWords, type ClientStatus } from './status'
import type { Gym, Membership, Payment, TemplateKind } from './types'

export const TEMPLATE_KINDS: TemplateKind[] = ['welcome', 'renewal', 'expired', 'due', 'received', 'trial', 'portal']

export const TEMPLATE_LABEL: Record<TemplateKind, string> = {
  welcome: 'Welcome',
  renewal: 'Renewal reminder',
  expired: 'Missed you',
  due: 'Payment due',
  received: 'Payment received',
  trial: 'Thanks for your request',
  portal: 'See your plan online',
}

export const DEFAULT_TEMPLATES: Record<TemplateKind, string> = {
  welcome: 'Hi {first}, welcome to {gym}! Your {plan} plan runs from {start} to {end}. {payment_line} See you at the gym.',
  renewal: 'Hi {first}, your {plan} plan at {gym} ends {ends_in} ({end}). Renew at the desk or reply here to keep going.',
  expired: 'Hi {first}, we have missed you at {gym}. Your {plan} plan ended on {end}. Reply here whenever you want to start again.',
  due: 'Hi {first}, a gentle reminder that {due} is still due for your {plan} plan at {gym}. You can pay at the desk by cash or UPI.',
  received: 'Thanks {first}, we received {amount} at {gym} on {paid_on}. Receipt no. {receipt}. {balance_line}',
  trial: 'Hi {first}, thanks for your request to join {gym}. Come to the front desk any day and we will get you started.',
  portal: 'Hi {first}, you can see your plan and payments here: {link} Sign in with Google using {email}.',
}

/** Which blanks each template can use, shown under the editor. */
export const TEMPLATE_VARS = ['first', 'name', 'gym', 'plan', 'start', 'end', 'ends_in', 'price', 'paid', 'due', 'payment_line',
  'amount', 'paid_on', 'receipt', 'balance_line', 'link', 'email'] as const
export type Vars = Partial<Record<(typeof TEMPLATE_VARS)[number], string>>

export const templateFor = (gym: Pick<Gym, 'templates'>, kind: TemplateKind): string => {
  const own = gym.templates?.[kind]
  return typeof own === 'string' && own.trim() ? own : DEFAULT_TEMPLATES[kind]
}

/** Fills {blanks}. A blank with no value disappears, and the spaces around it are tidied. */
export function render(template: string, vars: Vars): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string | undefined>)[k] ?? '')
    .replace(/\( *\)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .replace(/ +\n/g, '\n')
    .trim()
}

export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? ''

export function paymentLine(paid: number, due: number): string {
  if (paid <= 0 && due <= 0) return ''
  if (paid <= 0) return `Amount due: ${inr(due)}.`
  if (due <= 0) return `Paid in full: ${inr(paid)}.`
  return `Paid ${inr(paid)}, ${inr(due)} still due.`
}

export interface VarInput {
  gym: Pick<Gym, 'name'>
  name: string
  email?: string | null
  link?: string
  status?: ClientStatus
  membership?: Membership | null // the plan the message is about. Defaults to the current or latest one.
  payments?: Payment[] // all of this client's payments, to work out what was paid on the plan
  payment?: Payment // the payment the message is about
}

export function buildVars(i: VarInput): Vars {
  const m = i.membership ?? i.status?.current ?? i.status?.latest ?? null
  const due = i.status?.due ?? 0
  const end = i.status?.coveredThrough ?? m?.end_date ?? ''
  const paidOnPlan = m && i.payments ? m.price - dueOn(m, i.payments) : 0
  return {
    first: firstName(i.name), name: i.name.trim(), gym: i.gym.name,
    plan: m?.plan_name ?? '', start: m ? fmtDate(m.start_date) : '', end: end ? fmtDate(end) : '',
    ends_in: i.status?.daysLeft != null ? endsInWords(i.status.daysLeft) : '',
    price: m ? inr(m.price) : '', paid: inr(paidOnPlan), due: inr(due),
    payment_line: m ? paymentLine(paidOnPlan, Math.max(0, m.price - paidOnPlan)) : '',
    amount: i.payment ? inr(i.payment.amount) : '', paid_on: i.payment ? fmtDate(i.payment.paid_on) : '',
    receipt: i.payment ? String(i.payment.receipt_no) : '',
    balance_line: due > 0 ? `${inr(due)} is still due.` : 'Nothing is due now.',
    link: i.link ?? '', email: i.email ?? '',
  }
}

/** The template that fits where a client stands, for the default choice in the message sheet. */
export function suggestedKind(status: ClientStatus): TemplateKind {
  if (status.state === 'ending') return 'renewal'
  if (status.state === 'expired') return 'expired'
  if (status.due > 0) return 'due'
  return 'welcome'
}

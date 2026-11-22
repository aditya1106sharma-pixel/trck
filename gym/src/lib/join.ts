// The public join form: questions, checks and what gets sent. The database checks everything again.
import { isDate } from './dates'
import { normalizePhone } from './phone'
import type { Health } from './types'

export interface JoinForm {
  full_name: string
  phone: string
  email: string
  dob: string
  gender: string
  goal: string
  emergency_name: string
  emergency_phone: string
  source: string
  plan_interest: string
  health: Health
  health_note: string
  consent_terms: boolean
  consent_whatsapp: boolean
  website: string // a hidden field people never see. Bots fill it, and then nothing is sent.
}

export const blankJoin = (): JoinForm => ({
  full_name: '', phone: '', email: '', dob: '', gender: '', goal: '', emergency_name: '', emergency_phone: '', source: '',
  plan_interest: '', health: {}, health_note: '', consent_terms: false, consent_whatsapp: true, website: '',
})

// Plain yes or no questions, based on common gym pre exercise checks. Not a medical assessment.
export const HEALTH_QUESTIONS: { key: string; q: string }[] = [
  { key: 'heart', q: 'Has a doctor ever said you have a heart condition?' },
  { key: 'chest', q: 'Do you get chest pain when you are active?' },
  { key: 'dizzy', q: 'Do you lose balance from dizziness, or ever faint?' },
  { key: 'bp', q: 'Do you take medicine for blood pressure or a heart condition?' },
  { key: 'joint', q: 'Do you have a bone, joint or back problem that exercise could make worse?' },
  { key: 'pregnant', q: 'Are you pregnant, or did you give birth in the last 6 months?' },
  { key: 'other', q: 'Is there any other reason you should not exercise without advice?' },
]

export const GOALS = ['Lose fat', 'Build muscle', 'Get fit', 'Strength', 'Sport']
export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
export const SOURCES = ['Walked in', 'Friend', 'Instagram', 'Google Maps', 'Other']
export const STEPS = ['Contact', 'About you', 'Health and consent'] as const

export type Errors = Partial<Record<keyof JoinForm, string>>
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function checkStep(step: number, f: JoinForm, today: string): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (f.full_name.trim().replace(/\s+/g, ' ').length < 2) e.full_name = 'Add your full name.'
    if (!normalizePhone(f.phone)) e.phone = 'Use a 10 digit mobile number.'
    if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = 'Check the email address.'
  }
  if (step === 1) {
    if (f.dob) {
      const min = `${Number(today.slice(0, 4)) - 10}${today.slice(4)}`
      if (!isDate(f.dob) || f.dob < '1920-01-01' || f.dob > min) e.dob = 'Check the date of birth.'
    }
    if (f.emergency_phone.trim() && !normalizePhone(f.emergency_phone)) e.emergency_phone = 'Use a 10 digit mobile number.'
  }
  if (step === 2) {
    if (HEALTH_QUESTIONS.some((h) => typeof f.health[h.key] !== 'boolean')) e.health = 'Answer each question with yes or no.'
    if (!f.consent_terms) e.consent_terms = 'Please agree to continue.'
  }
  return e
}

export const anyYes = (h: Health): boolean => Object.values(h).some((v) => v === true)

/** What submit_join_request receives. Phones go in as +91XXXXXXXXXX. */
export function toPayload(f: JoinForm): Record<string, unknown> {
  const t = (s: string) => s.trim().replace(/\s+/g, ' ')
  return {
    full_name: t(f.full_name), phone: normalizePhone(f.phone), email: t(f.email).toLowerCase() || null,
    dob: f.dob || null, gender: f.gender || null, goal: f.goal || null, emergency_name: t(f.emergency_name) || null,
    emergency_phone: f.emergency_phone.trim() ? normalizePhone(f.emergency_phone) : null, source: f.source || null,
    plan_interest: f.plan_interest || null, health: f.health, health_note: anyYes(f.health) ? t(f.health_note) || null : null,
    consent_terms: f.consent_terms, consent_whatsapp: f.consent_whatsapp,
  }
}

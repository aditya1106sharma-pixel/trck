// Row shapes as they come back from Supabase. Names match supabase/gym/schema.sql exactly. Never rename one here alone.

export type Role = 'owner' | 'staff' | 'client'
export type Method = 'cash' | 'upi' | 'card' | 'bank' | 'other'
export const METHODS: Method[] = ['upi', 'cash', 'card', 'bank', 'other']
export const METHOD_LABEL: Record<Method, string> = { upi: 'UPI', cash: 'Cash', card: 'Card', bank: 'Bank transfer', other: 'Other' }

export interface Gym {
  id: string
  slug: string
  name: string
  phone: string | null
  address: string | null
  time_zone: string
  templates: Partial<Record<TemplateKind, string>>
  join_open: boolean
}

export interface Staff {
  id: string
  gym_id: string
  email: string
  user_id: string | null
  role: 'owner' | 'staff'
  name: string | null
  created_at: string
}

export interface Plan {
  id: string
  gym_id: string
  name: string
  months: number
  days: number
  price: number
  active: boolean
  sort: number
}

export type Health = Record<string, boolean>

export interface JoinRequest {
  id: string
  gym_id: string
  status: 'pending' | 'approved' | 'rejected'
  full_name: string
  phone: string
  email: string | null
  dob: string | null
  gender: string | null
  goal: string | null
  emergency_name: string | null
  emergency_phone: string | null
  source: string | null
  plan_interest: string | null
  health: Health
  health_flag: boolean
  health_note: string | null
  consent_whatsapp: boolean
  client_id: string | null
  reject_reason: string | null
  created_at: string
  decided_at: string | null
}

export interface Client {
  id: string
  gym_id: string
  user_id: string | null
  full_name: string
  phone: string
  email: string | null
  dob: string | null
  gender: string | null
  goal: string | null
  emergency_name: string | null
  emergency_phone: string | null
  source: string | null
  health: Health
  health_flag: boolean
  health_note: string | null
  consent_whatsapp: boolean
  notes: string | null
  archived: boolean
  created_at: string
}

export interface Membership {
  id: string
  gym_id?: string
  client_id: string
  plan_id?: string | null
  plan_name: string
  start_date: string
  end_date: string
  price: number
  status: 'active' | 'cancelled'
  note?: string | null
  cancel_reason?: string | null
  created_at?: string
}

export interface Payment {
  id: string
  receipt_no: number
  gym_id?: string
  client_id: string
  membership_id: string | null
  amount: number
  method: Method
  paid_on: string
  note?: string | null
  voided?: boolean
  void_reason?: string | null
  created_at?: string
}

export interface Message {
  id: string
  client_id: string | null
  request_id: string | null
  kind: string
  channel: 'copy' | 'whatsapp'
  body: string
  created_at: string
}

export type TemplateKind = 'welcome' | 'renewal' | 'expired' | 'due' | 'received' | 'trial' | 'portal'

export interface Who {
  role: Role | null
  gym_id?: string
  client_id?: string
  email?: string
  ambiguous?: boolean
}

export interface Home {
  client: { id: string; full_name: string; phone: string; email: string | null }
  gym: { name: string; phone: string | null; address: string | null; today: string }
  memberships: Membership[]
  payments: Payment[]
}

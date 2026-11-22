// Phone numbers are stored in one shape, +<country><number>, the same shape WhatsApp links need.

/**
 * Turns whatever was typed into +91XXXXXXXXXX, or null if it cannot be a real number.
 * Indian mobiles are 10 digits starting 6 to 9. A leading 0, 91 or +91 is dropped first.
 * A number typed with a different + country code is kept as typed if it has 8 to 15 digits.
 */
export function normalizePhone(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  if (s.startsWith('+') && !digits.startsWith('91')) return /^[1-9]\d{7,14}$/.test(digits) ? '+' + digits : null
  let d = digits
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  else if (d.length === 13 && d.startsWith('091')) d = d.slice(3)
  return /^[6-9]\d{9}$/.test(d) ? '+91' + d : null
}

/** +919876543210 reads as 98765 43210. Other countries keep their code. */
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164)
  return m ? `${m[1]} ${m[2]}` : e164
}

/** The digits wa.me wants: country code and number, nothing else. */
export const waDigits = (e164: string): string => e164.replace(/\D/g, '')

/** A link that opens WhatsApp on this phone with the message typed in. The owner still presses send. */
export function waLink(e164: string, text: string): string {
  return `https://wa.me/${waDigits(e164)}?text=${encodeURIComponent(text)}`
}

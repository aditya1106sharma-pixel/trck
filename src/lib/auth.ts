// Small rules for sign in and password reset. No network and no React, so they can be tested.

export const MIN_PASSWORD = 6 // the same minimum Supabase enforces

export function passwordProblem(pw: string, again: string): string {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (pw !== again) return 'The two passwords do not match.'
  return ''
}

/** Where the reset email sends the person back to: this app, with no old tokens or search in the address. */
export function resetRedirect(loc: { origin: string; pathname: string }): string {
  return loc.origin + loc.pathname
}

/** The proof in a reset email link. Supabase puts it after the #. Only a link with both tokens counts. */
export function recoveryTokens(hash: string): { access_token: string; refresh_token: string } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const access_token = p.get('access_token')
  const refresh_token = p.get('refresh_token')
  return p.get('type') === 'recovery' && access_token && refresh_token ? { access_token, refresh_token } : null
}

/**
 * What the address the person landed on says. 'recovery' is a link with tokens in it, 'expired' is a used or old one.
 * Read it at startup, then wipe the address, so the tokens never sit in the browser history.
 */
export function recoveryKind(hash: string, search = ''): 'recovery' | 'expired' | null {
  if (recoveryTokens(hash)) return 'recovery'
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const q = new URLSearchParams(search.replace(/^\?/, ''))
  const get = (k: string) => p.get(k) ?? q.get(k)
  const code = get('error_code')
  if (code === 'otp_expired' || code === 'otp_disabled') return 'expired'
  return null
}

/** Supabase's wording is for developers. These are for the person using the app. Anything else passes through unchanged. */
export function friendlyAuthError(msg: string): string {
  if (/rate limit|security purposes|too many requests/i.test(msg)) return 'Too many tries. Wait a minute, then try again.'
  if (/not authorized|not part of the project/i.test(msg)) return 'This email could not be sent yet. Ask Aditya to finish the email setup.'
  if (/auth session missing|link.*(expired|invalid)|otp.*expired|token.*expired/i.test(msg)) return 'That link has expired. Ask for a new reset email.'
  if (/same password|different from the old/i.test(msg)) return 'Pick a password you have not used before.'
  return msg
}

export const CODE_MIN = 6
export const CODE_MAX = 10 // Supabase lets a project choose 6 to 10 digits

/** What was typed, kept to digits only. A pasted code with spaces or a dash still works. */
export const cleanCode = (raw: string): string => raw.replace(/\D/g, '').slice(0, CODE_MAX)

export const codeReady = (raw: string): boolean => cleanCode(raw).length >= CODE_MIN

/** A wrong, old or used code. Anything else goes through the normal sign in wording. */
export function friendlyCodeError(msg: string): string {
  if (/expired|invalid|incorrect|not found/i.test(msg)) return 'That code is wrong or has expired. Ask for a new one.'
  return friendlyAuthError(msg)
}

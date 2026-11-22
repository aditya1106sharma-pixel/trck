// Turns database and network errors into sentences a gym owner can act on.

export const isNetworkError = (msg: string): boolean => /failed to fetch|network ?error|load failed|networkerror|fetch failed|timed? ?out/i.test(msg)

export function friendlyError(e: { message?: string; code?: string }): string {
  const msg = e.message ?? ''
  if (isNetworkError(msg)) return 'No connection. Check the internet and try again.'
  if (e.code === 'P0001') return msg // our own rule messages in schema.sql are written for people
  if (e.code === '23505' || /duplicate key/i.test(msg)) {
    if (/phone/i.test(msg)) return 'A client with this phone number already exists. Search for them in Clients.'
    if (/email/i.test(msg)) return 'That email is already on the list.'
    return 'This already exists.'
  }
  if (e.code === '23514' || /check constraint/i.test(msg)) return 'One of the values is not allowed. Check the form and try again.'
  if (e.code === '42501' || /permission denied|row-level security/i.test(msg)) return 'You do not have access to do that. Ask the owner.'
  if (/JWT|expired|invalid claim|not authenticated/i.test(msg)) return 'You were signed out. Sign in again.'
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a minute, then try again.'
  return 'Something went wrong. Try again, and if it keeps happening tell Aditya.'
}

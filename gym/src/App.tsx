// Decides which app to show: the public join form, sign in, the owner and staff app, or a member's own page.
import { useEffect, useState } from 'react'
import { track, useSession, whoami } from './api'
import type { Who } from './lib/types'
import { ClientHome, NoAccess, SignIn } from './screens/Access'
import { Join } from './screens/Join'
import { Owner } from './screens/Owner'
import { ErrorBoundary, Failed, Loading, Toaster, useRoute } from './ui/bits'

function Signed({ userId }: { userId: string }) {
  const [who, setWho] = useState<Who | null>(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); whoami().then((w) => { setWho(w); if (w.role) track('signed_in', { role: w.role }) }, (e: Error) => setErr(e.message)) }
  useEffect(load, [userId])
  if (err) return <div className="page"><Failed message={err} retry={load} /></div>
  if (!who) return <div className="page"><Loading label="Signing in" /></div>
  if ((who.role === 'owner' || who.role === 'staff') && who.gym_id) return <Owner gymId={who.gym_id} role={who.role} userId={userId} />
  if (who.role === 'client') return <ClientHome />
  return <NoAccess email={who.email} ambiguous={who.ambiguous} />
}

export function App() {
  const route = useRoute()
  const { session, ready } = useSession()
  let screen
  if (route[0] === 'join' && route[1]) screen = <Join slug={route[1]} />
  else if (!ready) screen = <div className="page"><Loading /></div>
  else if (!session) screen = <SignIn />
  else screen = <Signed key={session.user.id} userId={session.user.id} />
  return <ErrorBoundary><div className="app">{screen}</div><Toaster /></ErrorBoundary>
}

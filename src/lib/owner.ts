// Remembers whose log is on this device, so one person's log is never merged into another's account.
const OWNER_KEY = 'trck:owner'

type Mem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readOwner(mem: Mem = localStorage): string | null {
  try { return mem.getItem(OWNER_KEY) } catch { return null }
}
export function writeOwner(id: string, mem: Mem = localStorage): void {
  try { mem.setItem(OWNER_KEY, id) } catch { /* private mode */ }
}
export function clearOwner(mem: Mem = localStorage): void {
  try { mem.removeItem(OWNER_KEY) } catch { /* private mode */ }
}

/**
 * What to do when `userId` signs in on a device whose log belongs to `owner`.
 * keep: same person. adopt: nobody owned it yet, or it is empty, so it is theirs now.
 * clear: a different person's log is here, so back it up and start empty instead of merging it in.
 */
export function ownerAction(owner: string | null, userId: string, hasLog: boolean): 'keep' | 'adopt' | 'clear' {
  if (owner === userId) return 'keep'
  if (owner === null || !hasLog) return 'adopt'
  return 'clear'
}

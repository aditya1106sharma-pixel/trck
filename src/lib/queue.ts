// Runs syncs one at a time, and lets a sign out cancel anything that has not finished.
export function createSyncQueue() {
  let epoch = 0
  let tail: Promise<unknown> = Promise.resolve()
  let waiting: Promise<boolean> | null = null

  return {
    /** A call made while another is still waiting to start shares that run, so edits do not pile up syncs. */
    run(task: (isCurrent: () => boolean) => Promise<boolean>): Promise<boolean> {
      if (waiting) return waiting
      const mine = epoch
      const isCurrent = () => mine === epoch
      const p: Promise<boolean> = tail.then(() => {
        waiting = null
        return isCurrent() ? task(isCurrent) : false
      })
      waiting = p
      tail = p.catch(() => false)
      return p
    },
    /** Cancels anything not started, tells the one in flight it is no longer current, and waits for it to end. */
    async stop(): Promise<void> {
      epoch += 1
      waiting = null
      await tail
    },
  }
}

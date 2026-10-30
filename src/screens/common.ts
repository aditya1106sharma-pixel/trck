import type { Store } from '../lib/store'
import type { useSync } from '../lib/sync'
export type ScreenProps = { store: Store; sel: string; today: string; toast: (m: string) => void; sync: ReturnType<typeof useSync> }
export const uid = () => Math.random().toString(36).slice(2, 9)

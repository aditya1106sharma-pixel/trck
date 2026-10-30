import { useEffect, useState } from 'react'
import { applyUpdate, onUpdateReady } from '../lib/update'

export function UpdateBar() {
  const [ready, setReady] = useState(false)
  useEffect(() => onUpdateReady(setReady), [])
  if (!ready) return null
  return (
    <div className="updatebar" role="status">
      <span>Update ready</span>
      <button className="btn" onClick={applyUpdate}>Tap to reload</button>
    </div>
  )
}

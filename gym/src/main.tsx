import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { watchErrors } from './api'
import './gym.css'

watchErrors()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

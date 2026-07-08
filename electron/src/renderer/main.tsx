import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { RiskRegisterApp } from './RiskRegisterApp'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root-Element wurde nicht gefunden')
}

createRoot(root).render(
  <StrictMode>
    <RiskRegisterApp />
  </StrictMode>
)

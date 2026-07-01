import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithProviders from './AppWithProviders.jsx'
import { installChunkErrorAutoReload } from './utils/chunkReload.js'

// Recover automatically from stale-chunk failures after a new build, including
// the ones that happen before/outside React (modulepreload, eager route chunks).
installChunkErrorAutoReload()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithProviders />
  </StrictMode>,
)

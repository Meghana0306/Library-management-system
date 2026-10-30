import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'

// Self-hosted variable fonts — no CDN or Google Fonts request at runtime.
// Inter carries body/UI and tables; Source Serif 4 carries headings and the
// wordmark (see theme.js).
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'

// Layered builds so the `base` layer in index.css can override Mantine globals.
import '@mantine/core/styles.layer.css'
import '@mantine/dates/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import './index.css'

import App from './App.jsx'
import { theme } from './theme'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AiCapabilityProvider } from './ai/AiCapabilityContext.jsx'

const colorSchemeManager = localStorageColorSchemeManager({ key: 'library-color-scheme' })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      colorSchemeManager={colorSchemeManager}
    >
      <Notifications position="top-right" limit={3} />
      <ModalsProvider>
        <AuthProvider>
          <AiCapabilityProvider>
            <App />
          </AiCapabilityProvider>
        </AuthProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)

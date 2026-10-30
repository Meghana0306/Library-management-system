import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function bypassPdfjsCss() {
  const VIRTUAL_ID = '\0pdfjs-css-bypass'

  return {
    name: 'bypass-pdfjs-css',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('.css') && id.includes('pdfjs-dist')) {
        return VIRTUAL_ID
      }
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        const cssPath = require.resolve('pdfjs-dist/web/pdf_viewer.css')
        const css = readFileSync(cssPath, 'utf-8')
        return `
          if (typeof document !== 'undefined') {
            const styleId = 'pdfjs-dist-styles';
            if (!document.getElementById(styleId)) {
              const el = document.createElement('style');
              el.id = styleId;
              el.textContent = ${JSON.stringify(css)};
              document.head.appendChild(el);
            }
          }
          export default {};
        `
      }
    }
  }
}


const backendTarget =
  process.env.BACKEND_URL || 'http://localhost:8080'

const apiProxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
    rewrite: (path) => path
  }
}

export default defineConfig({
  plugins: [react(), bypassPdfjsCss()],

  optimizeDeps: {
    // pdfjs-dist is excluded because it ships its own worker bundle and the
    // bypassPdfjsCss plugin handles its CSS — letting Vite pre-bundle it causes
    // duplicate-style and worker-path issues.
    exclude: ['pdfjs-dist'],

    // Explicitly listing the remaining heavy deps means Vite pre-bundles them
    // all in a single esbuild pass at startup, rather than discovering them
    // lazily on the first browser request (which triggers a full page reload).
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'axios',
      'recharts',
      'jspdf',
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/form',
      '@mantine/dates',
      '@mantine/modals',
      '@mantine/notifications',
      '@tabler/icons-react',
    ],
  },

  server: {
    port: 3000,

    // Pre-transform your most-visited source files while the dev server is
    // booting. This means the first page load in the browser is instant instead
    // of waiting for on-demand compilation.
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/theme.js',
        './src/services/index.js',
        './src/auth/AuthContext.jsx',
        './src/components/layout/PortalShell.jsx',
        './src/pages/LandingPage.jsx',
        './src/features/student/StudentPortal.jsx',
        './src/features/author/AuthorPortal.jsx',
        './src/features/librarian/LibrarianPortal.jsx',
      ],
    },

    proxy: apiProxy
  },

  preview: {
    port: 3000,
    proxy: apiProxy
  }
})

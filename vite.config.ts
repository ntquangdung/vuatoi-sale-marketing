import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { accountApiPlugin } from './backend/dev-plugin.mjs'

export default defineConfig({
  plugins: [react(), accountApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/auth') || id.includes('node_modules/firebase/auth')) return 'firebase-auth'
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) return 'firebase-firestore'
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/react')) return 'react'
        },
      },
    },
  },
})

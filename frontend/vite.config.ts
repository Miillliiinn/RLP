import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: {
      protocol: 'ws',    // On repasse en 'ws' (non-sécurisé)
      host: 'localhost',
      port: 5173,        // On s'aligne sur le port de Vite
    },
  },
})
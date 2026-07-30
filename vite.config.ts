import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
    allowedHosts: ['tough-actually-imp.ngrok-free.app', '40let.mazamov.me', '149.102.143.196:5173'],
  },
})

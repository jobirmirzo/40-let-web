import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
    allowedHosts: ['tough-actually-imp.ngrok-free.app', 'e56b-185-139-138-222.ngrok-free.app', '149.102.143.196:3003'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['tough-actually-imp.ngrok-free.app'],
    // Proxy the API so the browser stays same-origin and the ASP.NET app needs
    // no CORS config. `http` profile in 40Let/Properties/launchSettings.json.
    proxy: {
      '/api': {
        target: 'http://localhost:5218',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

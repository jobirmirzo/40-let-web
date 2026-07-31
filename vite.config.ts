import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Free ngrok gives a new random subdomain on every restart, so pin the
    // list here is a losing game — just trust any host in dev.
    allowedHosts: true,
    proxy: {
      // Local `dotnet run` (see 40-let/Properties/launchSettings.json) — mirrors
      // the /api/ -> backend stripping nginx.conf.template does in production.
      '/api': {
        target: 'http://localhost:5218',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

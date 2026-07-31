import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
    allowedHosts: ['tough-actually-imp.ngrok-free.app', '40let.mazamov.me', '149.102.143.196:5173'],
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

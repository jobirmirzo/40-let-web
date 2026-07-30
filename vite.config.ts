import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
<<<<<<< HEAD
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
=======
    port: 3003,
    strictPort: true,
    allowedHosts: ['tough-actually-imp.ngrok-free.app', '40let.mazamov.me', '149.102.143.196:5173'],
>>>>>>> b3a4442d98db444e46bbc1fdbf8ac03ea99397cd
  },
})

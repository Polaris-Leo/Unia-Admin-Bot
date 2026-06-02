import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'

const logger = createLogger()
const _error = logger.error.bind(logger)
logger.error = (msg, opts) => {
  if (msg.includes('ws proxy')) return
  _error(msg, opts)
}

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws/danmaku': {
        target: 'ws://localhost:3001',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {})
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', () => {})
          })
        }
      }
    }
  }
})

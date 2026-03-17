import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'

// Vite 기본 http-proxy는 SSL 재협상(renegotiation)을 지원하지 않아
// 관세청 서버 연결 실패 → Node.js 내장 https 모듈로 직접 프록시 처리
function unipassProxyPlugin() {
  return {
    name: 'unipass-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/unipass')) return next()
        const targetPath = req.url.replace(/^\/api\/unipass/, '')
        console.log('[unipass →]', targetPath)
        const proxyReq = https.request(
          {
            hostname: 'unipass.customs.go.kr',
            port: 38010,
            path: targetPath,
            method: 'GET',
            rejectUnauthorized: false,
          },
          (proxyRes) => {
            console.log('[unipass ←]', proxyRes.statusCode)
            res.writeHead(proxyRes.statusCode, {
              'content-type': proxyRes.headers['content-type'] ?? 'application/xml',
            })
            proxyRes.pipe(res)
          }
        )
        proxyReq.on('error', (err) => {
          console.error('[unipass error]', err.message)
          res.writeHead(502)
          res.end(err.message)
        })
        proxyReq.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), unipassProxyPlugin()],
  server: {
    historyApiFallback: true,  // /admin 등 SPA 경로를 index.html로 서빙
  },
})

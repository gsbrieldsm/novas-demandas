import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      // Site institucional (estático) na raiz
      { source: '/', destination: '/site.html' },
      // Landing exclusiva de captação audiovisual
      { source: '/captacao', destination: '/captacao.html' },
      // Política de privacidade (exigida pela Meta para o app GM & Co Tráfego)
      { source: '/privacidade', destination: '/privacidade.html' },
    ]
  },
}

export default nextConfig

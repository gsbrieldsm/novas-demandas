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
    ]
  },
}

export default nextConfig

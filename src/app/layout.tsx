import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://gmeco.com.br'),
  title: {
    default: 'Gabriel Moraes & Co',
    template: '%s · Gabriel Moraes & Co',
  },
  description: 'Marketing estratégico com propósito. Cada ação que entregamos tem um porquê claro.',
  openGraph: {
    title: 'Gabriel Moraes & Co',
    description: 'Marketing estratégico com propósito',
    url: 'https://gmeco.com.br',
    siteName: 'Gabriel Moraes & Co',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

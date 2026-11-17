'use client'

import { usePathname } from 'next/navigation'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import clsx from 'clsx'
import { AdminSidebar } from '@/components/AdminSidebar'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

// Telas com layout próprio em tela cheia.
const BARE = [/^\/admin\/login/, /^\/admin\/estrategia\//]
// Documentos: mantêm papel claro para leitura e impressão.
const PAPER = [/^\/admin\/proposta\/(?!nova)/, /^\/admin\/relatorio\//, /^\/admin\/recibo/]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (BARE.some(re => re.test(pathname))) {
    return <div className={clsx(display.variable, mono.variable)}>{children}</div>
  }

  const paper = PAPER.some(re => re.test(pathname))

  return (
    <div className={clsx('gm-shell', display.variable, mono.variable, !paper && 'gm-light')}>
      <AdminSidebar />
      <div key={pathname} className="md:pl-[72px] print:pl-0 animate-gm-enter print:animate-none">
        {children}
      </div>
    </div>
  )
}

'use client'

import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import clsx from 'clsx'

const GOLD = '#C5A880'

export function AdminNav({ onLogout, extra }: { onLogout: () => void; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const links = [
    { label: 'Gestão', href: '/admin' },
    { label: 'Financeiro', href: '/admin/financeiro' },
    { label: 'Demandas', href: '/admin/demandas' },
  ]

  return (
    <header
      className="px-6 py-0 flex items-center justify-between shadow-md"
      style={{
        background: 'radial-gradient(ellipse 60% 150% at 95% 50%, #C5A880 0%, #6B4C28 40%, transparent 70%), #100E0B',
      }}
    >
      <div className="flex items-center gap-8">
        <div className="py-3">
          <Image
            src="/logo-symbol.png"
            alt="GM&Co"
            width={36}
            height={36}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>
        <nav className="flex items-center h-full">
          {links.map(link => {
            const active = pathname === link.href
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={clsx(
                  'px-4 py-5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  active
                    ? 'text-white border-[#C5A880]'
                    : 'text-white/50 border-transparent hover:text-white/80'
                )}
              >
                {link.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <button
          onClick={() => router.push('/chat')}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border text-white/60 hover:text-white transition-colors"
          style={{ borderColor: `${GOLD}40` }}
        >
          Portal →
        </button>
        <button
          onClick={onLogout}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}

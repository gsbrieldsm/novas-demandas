'use client'

import { useRouter, usePathname } from 'next/navigation'
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
    <header className="bg-white border-b border-slate-100 px-6 py-0 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-8">
        <div className="py-4 flex items-center gap-2">
          <div
            className="w-1 h-6 rounded-full"
            style={{ backgroundColor: GOLD }}
          />
          <span className="font-bold text-slate-900 tracking-tight">GM&Co</span>
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
                    ? 'border-[#C5A880] text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
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
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
        >
          Portal →
        </button>
        <button
          onClick={onLogout}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}

'use client'

import { useRouter, usePathname } from 'next/navigation'
import clsx from 'clsx'

export function AdminNav({ onLogout, extra }: { onLogout: () => void; extra?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const links = [
    { label: 'Gestão', href: '/admin' },
    { label: 'Financeiro', href: '/admin/financeiro' },
    { label: 'Demandas', href: '/admin/demandas' },
  ]

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-bold text-slate-900">GM&Co</span>
        </div>
        <nav className="flex items-center gap-1">
          {links.map(link => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <button onClick={() => router.push('/chat')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Ver portal →
        </button>
        <button onClick={onLogout} className="text-sm text-slate-500 hover:text-slate-700">
          Sair
        </button>
      </div>
    </header>
  )
}

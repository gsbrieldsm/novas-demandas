'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })

    if (res.ok) {
      router.push('/portal')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'E-mail ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse 70% 80% at 92% -10%, #C5A880 0%, #8B6840 45%, transparent 70%), radial-gradient(ellipse 60% 80% at 8% 110%, #6B4C28 0%, #3a2a18 35%, transparent 65%), #100E0B',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <Image
              src="/logo-symbol.png"
              alt="Gabriel Moraes & Co"
              width={120}
              height={120}
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              priority
            />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Portal do Cliente</h1>
          <p className="text-white/50 text-sm mt-1">Gabriel Moraes &amp; Co</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-white/10">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1.5">E-mail</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email || !senha}
            className="w-full text-sm py-3 rounded-xl text-white font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #8B6840 100%)' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

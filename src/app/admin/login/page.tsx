'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
    } else {
      router.push('/admin')
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
              alt="GM&Co"
              width={64}
              height={64}
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              priority
            />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Painel GM&Co</h1>
          <p className="text-white/50 text-sm mt-1">Acesso restrito</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-white/10"
        >
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-3 rounded-xl font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
            style={{
              background:
                'linear-gradient(135deg, #C5A880 0%, #8B6840 100%)',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-8">
          GM&amp;Co · Marketing & Estratégia
        </p>
      </div>
    </div>
  )
}

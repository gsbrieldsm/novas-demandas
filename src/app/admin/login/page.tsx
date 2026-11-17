'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const CAMPO =
  'w-full rounded-xl border border-gm-line bg-gm-bg/60 px-4 py-3 text-sm text-gm-text placeholder:text-gm-muted/60 transition-shadow focus:outline-none focus:border-gm-accent focus:shadow-[0_0_0_3px_rgb(var(--gm-accent)/0.25)]'

const ROTULO = 'gm-mono block text-[10px] font-semibold uppercase tracking-[0.18em] text-gm-glow/80 mb-2'

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
    <div className="gm-login flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-gm-enter">
        <div className="text-center mb-8">
          {/* Núcleo: anéis girando em volta do símbolo */}
          <div className="relative mx-auto mb-6 h-32 w-32">
            <span className="absolute inset-0 rounded-full border border-gm-glow/30 border-t-gm-glow animate-[spin_7s_linear_infinite]" />
            <span className="absolute inset-[10px] rounded-full border border-dashed border-gm-accent/60 animate-[spin_16s_linear_infinite_reverse]" />
            <span className="absolute inset-[20px] rounded-full border border-gm-glow/25 border-b-gm-glow animate-[spin_4s_linear_infinite]" />
            <span className="absolute inset-[30px] flex items-center justify-center rounded-full bg-gradient-to-br from-gm-accent to-gm-glow shadow-[0_0_48px_-4px_rgb(var(--gm-accent)/0.9)]">
              <Image
                src="/logo-symbol.png"
                alt="Gabriel Moraes & Co"
                width={44}
                height={44}
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
                priority
              />
            </span>
          </div>

          <p className="gm-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-gm-glow/80">Acesso restrito</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-gm-glow bg-clip-text text-transparent">
            Gabriel Moraes &amp; Co
          </h1>
          <p className="mt-1.5 text-sm text-gm-muted">Identifique-se para iniciar o painel</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="gm-hero rounded-3xl p-6 space-y-5 backdrop-blur-xl"
          style={{ background: 'rgb(var(--gm-surface) / 0.8)' }}
        >
          {error && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="login-email" className={ROTULO}>E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={CAMPO}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label htmlFor="login-senha" className={ROTULO}>Senha</label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={CAMPO}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="relative z-10 w-full rounded-xl bg-gradient-to-r from-gm-accent to-gm-glow py-3 text-sm font-semibold text-white shadow-[0_0_28px_-6px_rgb(var(--gm-accent))] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Autenticando…
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="gm-mono mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-gm-muted/60">
          GM&amp;Co · Marketing &amp; Estratégia
        </p>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import clsx from 'clsx'
import { AdminSidebar } from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'
import { podeVerTela, telaInicial } from '@/lib/acesso'
import { useAcesso } from '@/lib/useAcesso'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

// Telas com layout próprio em tela cheia.
const BARE = [/^\/admin\/login/, /^\/admin\/estrategia\//]
// Documentos: mantêm papel claro para leitura e impressão.
const PAPER = [/^\/admin\/proposta\/(?!nova)/, /^\/admin\/relatorio\//, /^\/admin\/recibo/]

function SemAcesso({ motivo }: { motivo: string }) {
  const router = useRouter()
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'rgb(var(--gm-bg))' }}>
      <div className="max-w-sm text-center">
        <p className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">Sem acesso a esta área</p>
        <p className="mt-2 text-sm text-white/60">{motivo}</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/admin/login')
          }}
          className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Sair
        </button>
      </div>
    </div>
  )
}

/** Confere a permissão antes de mostrar a tela; sem permissão, manda para onde o membro pode ir. */
function Guarda({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const acesso = useAcesso()
  const liberado = acesso !== undefined && podeVerTela(acesso, pathname)
  const destino = acesso ? telaInicial(acesso) : null
  const [semSessao, setSemSessao] = useState<boolean | null>(null)

  useEffect(() => {
    if (acesso && !liberado && destino && destino !== pathname) router.replace(destino)
  }, [acesso, liberado, destino, pathname, router])

  // Sem login: vai para a tela de login. Com login e sem cadastro na equipe: avisa.
  useEffect(() => {
    if (acesso !== null) return
    supabase.auth.getSession().then(({ data }) => {
      setSemSessao(!data.session)
      if (!data.session) router.replace('/admin/login')
    })
  }, [acesso, router])

  if (acesso === undefined || (acesso === null && semSessao !== false)) {
    return <div className="min-h-screen" aria-busy="true" />
  }
  if (acesso === null) {
    return <SemAcesso motivo="Seu login ainda não tem acesso ao painel, ou o acesso foi desativado. Fale com o responsável pela equipe." />
  }
  if (!liberado) {
    return destino ? <div className="min-h-screen" aria-busy="true" /> : <SemAcesso motivo="Nenhum módulo foi liberado para o seu acesso ainda." />
  }
  return <>{children}</>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (/^\/admin\/login/.test(pathname)) {
    return <div className={clsx(display.variable, mono.variable)}>{children}</div>
  }

  if (BARE.some(re => re.test(pathname))) {
    return <div className={clsx(display.variable, mono.variable)}><Guarda>{children}</Guarda></div>
  }

  const paper = PAPER.some(re => re.test(pathname))

  return (
    <div className={clsx('gm-shell', display.variable, mono.variable, !paper && 'gm-light')}>
      <AdminSidebar />
      <div key={pathname} className="md:pl-[72px] print:pl-0 animate-gm-enter print:animate-none">
        <Guarda>{children}</Guarda>
      </div>
    </div>
  )
}

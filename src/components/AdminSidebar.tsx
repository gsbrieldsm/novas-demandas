'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { moduloDaTela, pode, type Acesso } from '@/lib/acesso'
import { useAcesso } from '@/lib/useAcesso'

type IconName = 'equipes' | 'social' | 'trafego' | 'agentes' | 'gestao' | 'demandas' | 'agenda' | 'clientes' | 'comercial' | 'financeiro' | 'portal' | 'sair'

interface NavLink {
  label: string
  href: string
  icon: IconName
  /** Rotas de detalhe que pertencem a esta seção. */
  match?: string[]
}

export const NAV_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Operação',
    links: [
      { label: 'Gestão', href: '/admin', icon: 'gestao' },
      { label: 'Demandas', href: '/admin/demandas', icon: 'demandas', match: ['/admin/chamado'] },
      { label: 'Agenda', href: '/admin/agenda', icon: 'agenda' },
      { label: 'Clientes', href: '/admin/clientes', icon: 'clientes', match: ['/admin/cliente/', '/admin/documento', '/admin/relatorio'] },
    ],
  },
  {
    title: 'Marketing',
    links: [
      { label: 'Social media', href: '/admin/social', icon: 'social' },
      { label: 'Tráfego pago', href: '/admin/trafego', icon: 'trafego' },
      { label: 'Agentes', href: '/admin/agentes', icon: 'agentes' },
    ],
  },
  {
    title: 'Negócio',
    links: [
      { label: 'Comercial', href: '/admin/comercial', icon: 'comercial', match: ['/admin/lead', '/admin/proposta'] },
      { label: 'Financeiro', href: '/admin/financeiro', icon: 'financeiro', match: ['/admin/recibo'] },
    ],
  },
  {
    title: 'Administração',
    links: [{ label: 'Equipes', href: '/admin/equipes', icon: 'equipes' }],
  },
]

/** Menu só com o que o membro pode ver; grupos vazios somem. */
export function gruposVisiveis(acesso: Acesso | null | undefined) {
  if (!acesso) return []
  return NAV_GROUPS.map(g => ({
    ...g,
    links: g.links.filter(l => {
      const m = moduloDaTela(l.href)
      if (m === null) return true
      if (m === 'dono') return acesso.papel === 'dono'
      return pode(acesso, m)
    }),
  })).filter(g => g.links.length > 0)
}

export function isNavActive(link: NavLink, pathname: string) {
  if (pathname === link.href) return true
  if (link.href !== '/admin' && pathname.startsWith(`${link.href}/`)) return true
  return (link.match ?? []).some(prefix => pathname.startsWith(prefix))
}

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  social: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </>
  ),
  equipes: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5.5 20c.5-3.6 3.2-6 6.5-6s6 2.4 6.5 6" />
      <path d="M17.5 10.5l1.2 1.2 2.3-2.4" />
    </>
  ),
  agentes: (
    <>
      <rect x="2.5" y="4" width="9" height="7" rx="2" />
      <rect x="12.5" y="13" width="9" height="7" rx="2" />
      <path d="M7 11v3a2 2 0 002 2h3.5M17 13v-3a2 2 0 00-2-2h-3.5" />
    </>
  ),
  trafego: (
    <>
      <path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z" />
      <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
    </>
  ),
  gestao: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  demandas: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.9c1.6.8 2.7 2.4 3 5.1" />
    </>
  ),
  comercial: (
    <>
      <path d="M3 17l5.5-5.5 4 4L21 7" />
      <path d="M15 7h6v6" />
    </>
  ),
  financeiro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.2c-.5-1-1.6-1.7-3-1.7-1.8 0-3 1-3 2.3 0 3 6 1.4 6 4.4 0 1.3-1.2 2.3-3 2.3-1.4 0-2.5-.7-3-1.7M12 5.5v1.9M12 16.5v2" />
    </>
  ),
  portal: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M19 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h4" />
    </>
  ),
  sair: (
    <>
      <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
}

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

const LABEL =
  'whitespace-nowrap opacity-0 -translate-x-2 transition-all duration-300 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 group-focus-within/rail:opacity-100 group-focus-within/rail:translate-x-0'

const ITEM =
  'relative flex items-center gap-3.5 h-11 pl-[13px] pr-3 rounded-xl text-sm font-medium transition-colors duration-200'

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const acesso = useAcesso()
  const grupos = gruposVisiveis(acesso)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <aside
      className="gm-chrome group/rail hidden md:flex print:hidden fixed inset-y-0 left-0 z-40 w-[72px] hover:w-60 focus-within:w-60 flex-col overflow-hidden border-r border-gm-line/60 bg-gm-bg transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:shadow-[24px_0_60px_-20px_rgb(0_0_0/0.7)]"
      aria-label="Navegação principal"
    >
      <Link href="/admin" className="flex items-center gap-3.5 h-16 pl-[18px] pr-3 flex-shrink-0">
        <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gm-accent to-gm-glow shadow-[0_0_24px_-4px_rgb(var(--gm-accent)/0.8)]">
          <Image
            src="/logo-symbol.png"
            alt=""
            width={22}
            height={22}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </span>
        <span className={clsx(LABEL, 'text-sm font-semibold tracking-tight text-gm-text')}>
          Gabriel Moraes &amp; Co
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        {grupos.map(group => (
          <div key={group.title} className="mt-4 first:mt-2">
            <p className={clsx(LABEL, 'px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gm-muted/70')}>
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.links.map(link => {
                const active = isNavActive(link, pathname)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        ITEM,
                        active
                          ? 'text-gm-text bg-gm-accent/15 shadow-[inset_0_0_0_1px_rgb(var(--gm-accent)/0.35)]'
                          : 'text-gm-muted hover:text-gm-text hover:bg-white/5'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-gm-glow transition-all duration-300',
                          active ? 'h-5 opacity-100 shadow-[0_0_12px_rgb(var(--gm-glow))]' : 'h-0 opacity-0'
                        )}
                      />
                      <NavIcon name={link.icon} className={clsx('flex-shrink-0', active && 'text-gm-glow')} />
                      <span className={LABEL}>{link.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gm-line/60 px-3 py-3 space-y-1 flex-shrink-0">
        <Link href="/chat" className={clsx(ITEM, 'text-gm-muted hover:text-gm-text hover:bg-white/5')}>
          <NavIcon name="portal" className="flex-shrink-0" />
          <span className={LABEL}>Portal do cliente</span>
        </Link>
        <button
          onClick={logout}
          className={clsx(ITEM, 'w-full text-gm-muted hover:text-red-300 hover:bg-red-500/10')}
        >
          <NavIcon name="sair" className="flex-shrink-0" />
          <span className={LABEL}>Sair</span>
        </button>
      </div>
    </aside>
  )
}

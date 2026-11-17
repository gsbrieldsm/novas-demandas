'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { AdminNav } from '@/components/AdminNav'
import { MODULOS, MODULO_LABEL, PERFIS, type Modulo, type Papel } from '@/lib/acesso'

interface Membro {
  user_id: string
  nome: string
  email: string
  cargo: string | null
  papel: Papel
  permissoes: Modulo[]
  ativo: boolean
  ultimo_login: string | null
  voce: boolean
}

interface SemAcesso {
  user_id: string
  email: string
  ultimo_login: string | null
}

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const CAMPO = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-gm-accent'
const ROTULO = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5'

function gerarSenha() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

function quando(iso: string | null) {
  if (!iso) return 'nunca entrou'
  const d = new Date(iso)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400_000)
  if (dias === 0) return 'entrou hoje'
  if (dias === 1) return 'entrou ontem'
  if (dias < 30) return `entrou há ${dias} dias`
  return `último acesso em ${d.toLocaleDateString('pt-BR')}`
}

function Iniciais({ nome, ativo }: { nome: string; ativo: boolean }) {
  const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
  return (
    <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white bg-gradient-to-br', ativo ? 'from-gm-accent to-gm-glow' : 'from-slate-300 to-slate-400')}>
      {ini || '?'}
    </span>
  )
}

function CampoSenha({ valor, onChange, id }: { valor: string; onChange: (v: string) => void; id: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="flex gap-2">
      <input id={id} value={valor} onChange={e => onChange(e.target.value)} placeholder="mínimo 8 caracteres" autoComplete="new-password" className={clsx(CAMPO, 'font-mono')} />
      <button type="button" onClick={() => onChange(gerarSenha())} className="rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap">Gerar</button>
      {valor && (
        <button
          type="button"
          onClick={async () => { await navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}
          className="rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
        >
          {copiado ? '✓' : 'Copiar'}
        </button>
      )}
    </div>
  )
}

function SeletorModulos({ valor, onChange }: { valor: Modulo[]; onChange: (v: Modulo[]) => void }) {
  const alternar = (m: Modulo) => onChange(valor.includes(m) ? valor.filter(x => x !== m) : [...valor, m])
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-slate-500 mr-1">Perfis rápidos:</span>
        {PERFIS.map(p => (
          <button key={p.nome} type="button" onClick={() => onChange(p.modulos)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-gm-accent hover:text-gm-accent">
            {p.nome}
          </button>
        ))}
        <button type="button" onClick={() => onChange([])} className="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-700">limpar</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map(m => {
          const marcado = valor.includes(m.id)
          const sensivel = m.id === 'financeiro' || m.id === 'gestao' || m.id === 'comercial'
          return (
            <label
              key={m.id}
              className={clsx(
                'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                marcado ? 'border-gm-accent/50 bg-gm-accent/5' : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <input type="checkbox" checked={marcado} onChange={() => alternar(m.id)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--gm-accent))]" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {m.label}
                  {sensivel && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">sensível</span>}
                </span>
                <span className="block text-xs text-slate-500">{m.descricao}</span>
              </span>
            </label>
          )
        })}
      </div>
      {!valor.includes('financeiro') && (
        <p className="mt-3 text-xs text-slate-500">Sem Financeiro, os valores em R$ de clientes e demandas aparecem em branco para esta pessoa, mesmo nas telas que ela pode abrir.</p>
      )}
    </div>
  )
}

function NovoAcesso({ inicial, onCriado, onCancelar }: { inicial?: SemAcesso; onCriado: () => void; onCancelar: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState(inicial?.email ?? '')
  const [cargo, setCargo] = useState('')
  const [senha, setSenha] = useState(inicial ? '' : gerarSenha())
  const [permissoes, setPermissoes] = useState<Modulo[]>(PERFIS[0].modulos)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function criar() {
    setSalvando(true)
    setErro('')
    const res = await api('/api/equipe', {
      method: 'POST',
      body: JSON.stringify({ nome, email, cargo, senha: senha || undefined, permissoes, user_id: inicial?.user_id }),
    })
    const corpo = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) return setErro(corpo.error || 'Não foi possível criar o acesso.')
    onCriado()
  }

  return (
    <div className={clsx(CARD, 'p-4 md:p-6 animate-gm-enter')}>
      <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">{inicial ? `Dar acesso a ${inicial.email}` : 'Novo acesso'}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="novo-nome" className={ROTULO}>Nome</label>
          <input id="novo-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Ana Souza" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="novo-cargo" className={ROTULO}>Cargo (opcional)</label>
          <input id="novo-cargo" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex.: Social media" className={CAMPO} />
        </div>
        {!inicial && (
          <div>
            <label htmlFor="novo-email" className={ROTULO}>E-mail de login</label>
            <input id="novo-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@gmeco.com.br" className={CAMPO} />
          </div>
        )}
        <div>
          <label htmlFor="novo-senha" className={ROTULO}>{inicial ? 'Nova senha (opcional)' : 'Senha inicial'}</label>
          <CampoSenha id="novo-senha" valor={senha} onChange={setSenha} />
        </div>
      </div>
      <div className="mt-5">
        <p className={ROTULO}>O que pode ver no sistema</p>
        <SeletorModulos valor={permissoes} onChange={setPermissoes} />
      </div>
      {erro && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}
      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">{senha ? 'Copie a senha e envie para a pessoa por um canal privado. Ela não aparece de novo.' : ''}</p>
        <div className="flex gap-2">
          <button onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-800">Cancelar</button>
          <button
            onClick={criar}
            disabled={salvando || !nome.trim() || (!inicial && (!email.trim() || senha.length < 8))}
            className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Criando…' : 'Criar acesso'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CartaoMembro({ m, onMudou }: { m: Membro; onMudou: () => void }) {
  const [editando, setEditando] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [cargo, setCargo] = useState(m.cargo ?? '')
  const [permissoes, setPermissoes] = useState<Modulo[]>(m.permissoes)
  const [papel, setPapel] = useState<Papel>(m.papel)
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function salvar(corpo: Record<string, unknown>, ok: string) {
    setSalvando(true)
    setMsg(null)
    const res = await api(`/api/equipe/${m.user_id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
    const r = await res.json().catch(() => ({}))
    setSalvando(false)
    if (!res.ok) return setMsg({ tipo: 'erro', texto: r.error || 'Não foi possível salvar.' })
    setMsg({ tipo: 'ok', texto: ok })
    setEditando(false)
    setTrocandoSenha(false)
    setSenha('')
    onMudou()
  }

  async function remover() {
    if (!confirm(`Remover o acesso de ${m.nome}? O login é apagado e a pessoa não entra mais no painel.`)) return
    const res = await api(`/api/equipe/${m.user_id}`, { method: 'DELETE' })
    const r = await res.json().catch(() => ({}))
    if (!res.ok) return setMsg({ tipo: 'erro', texto: r.error || 'Não foi possível remover.' })
    onMudou()
  }

  return (
    <li className={clsx(CARD, 'p-4 md:p-5', !m.ativo && 'opacity-70')}>
      <div className="flex items-start gap-3 flex-wrap">
        <Iniciais nome={m.nome} ativo={m.ativo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">{m.nome}</p>
            {m.voce && <span className="text-xs text-slate-400">(você)</span>}
            <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', m.papel === 'dono' ? 'bg-gm-accent/15 text-gm-accent' : 'bg-slate-100 text-slate-600')}>
              {m.papel === 'dono' ? 'Dono · acesso total' : 'Membro'}
            </span>
            {!m.ativo && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Desativado</span>}
          </div>
          <p className="text-xs text-slate-500 truncate">{[m.cargo, m.email, quando(m.ultimo_login)].filter(Boolean).join(' · ')}</p>
          {m.papel === 'membro' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.permissoes.length === 0 && <span className="text-xs text-amber-700">Nenhum módulo liberado</span>}
              {m.permissoes.map(p => <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{MODULO_LABEL[p]}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => { setEditando(e => !e); setTrocandoSenha(false) }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Editar acessos</button>
          <button onClick={() => { setTrocandoSenha(t => !t); setEditando(false); setSenha(gerarSenha()) }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Trocar senha</button>
          {!m.voce && (
            <>
              <button onClick={() => salvar({ ativo: !m.ativo }, m.ativo ? 'Acesso desativado.' : 'Acesso reativado.')} disabled={salvando} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                {m.ativo ? 'Desativar' : 'Reativar'}
              </button>
              <button onClick={remover} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50">Remover</button>
            </>
          )}
        </div>
      </div>

      {editando && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-4 animate-gm-enter">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`cargo-${m.user_id}`} className={ROTULO}>Cargo</label>
              <input id={`cargo-${m.user_id}`} value={cargo} onChange={e => setCargo(e.target.value)} className={CAMPO} />
            </div>
            {!m.voce && (
              <div>
                <label htmlFor={`papel-${m.user_id}`} className={ROTULO}>Papel</label>
                <select id={`papel-${m.user_id}`} value={papel} onChange={e => setPapel(e.target.value as Papel)} className={CAMPO}>
                  <option value="membro">Membro: vê só os módulos marcados</option>
                  <option value="dono">Dono: vê tudo e gerencia a equipe</option>
                </select>
              </div>
            )}
          </div>
          {papel === 'membro' && <SeletorModulos valor={permissoes} onChange={setPermissoes} />}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditando(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-800">Cancelar</button>
            <button onClick={() => salvar({ cargo, permissoes, papel }, 'Acessos atualizados.')} disabled={salvando} className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {trocandoSenha && (
        <div className="mt-4 border-t border-slate-100 pt-4 animate-gm-enter">
          <label htmlFor={`senha-${m.user_id}`} className={ROTULO}>Nova senha de {m.nome}</label>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[260px]"><CampoSenha id={`senha-${m.user_id}`} valor={senha} onChange={setSenha} /></div>
            <button onClick={() => salvar({ senha }, 'Senha trocada. A sessão atual da pessoa continua até ela sair.')} disabled={salvando || senha.length < 8} className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Salvar senha
            </button>
          </div>
        </div>
      )}

      {msg && <p className={clsx('mt-3 text-xs', msg.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-600')}>{msg.texto}</p>}
    </li>
  )
}

export default function EquipesPage() {
  const router = useRouter()
  const [membros, setMembros] = useState<Membro[]>([])
  const [semAcesso, setSemAcesso] = useState<SemAcesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [novo, setNovo] = useState<false | 'novo' | SemAcesso>(false)

  const carregar = useCallback(async () => {
    const res = await api('/api/equipe')
    const corpo = await res.json().catch(() => ({}))
    if (res.ok) {
      setMembros(corpo.membros)
      setSemAcesso(corpo.semAcesso)
      setSemTabela(false)
    } else {
      setSemTabela(/equipe_membros/.test(corpo.error ?? '') || corpo.code === '42P01' || corpo.code === 'PGRST205')
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const ativos = membros.filter(m => m.ativo)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <AdminNav onLogout={handleLogout} />

      <div className="max-w-5xl mx-auto w-full px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6">
        <div>
          <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Administração</p>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">Equipes</h1>
        </div>

        <div className="gm-hero rounded-2xl p-4 md:p-6" style={{ background: 'var(--gm-hero)' }}>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <p className="max-w-xl text-sm text-white/70">
              Crie logins para a equipe e escolha o que cada pessoa vê. O bloqueio vale no servidor: quem não tem um módulo não consegue abrir a tela nem buscar os dados dela.
            </p>
            {!novo && !semTabela && (
              <button onClick={() => setNovo('novo')} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">+ Novo acesso</button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 max-w-lg">
            {[
              { rotulo: 'Ativos', valor: ativos.length },
              { rotulo: 'Donos', valor: ativos.filter(m => m.papel === 'dono').length },
              { rotulo: 'Sem acesso', valor: semAcesso.length },
            ].map(s => (
              <div key={s.rotulo} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-white/60">{s.rotulo}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">{carregando ? '—' : s.valor}</p>
              </div>
            ))}
          </div>
        </div>

        {semTabela && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Falta criar a tabela no banco</p>
            <p className="mt-1">Rode no SQL Editor do Supabase o trecho “Equipes e acessos” do final de <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>. Até lá, todo login entra com acesso total.</p>
          </div>
        )}

        {novo && (
          <NovoAcesso
            inicial={novo === 'novo' ? undefined : novo}
            onCancelar={() => setNovo(false)}
            onCriado={() => { setNovo(false); carregar() }}
          />
        )}

        {!semTabela && (
          <ul className="space-y-3">
            {carregando && <li className="h-20 rounded-2xl bg-slate-100 animate-pulse" />}
            {membros.map(m => <CartaoMembro key={`${m.user_id}-${m.papel}-${m.ativo}-${m.permissoes.join()}`} m={m} onMudou={carregar} />)}
          </ul>
        )}

        {semAcesso.length > 0 && (
          <div className={clsx(CARD, 'p-4 md:p-5')}>
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Logins sem acesso ao painel</p>
            <p className="mt-1 text-sm text-slate-500">Existem no login do sistema, mas não entram no painel até você liberar.</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {semAcesso.map(u => (
                <li key={u.user_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400">{quando(u.ultimo_login)}</p>
                  </div>
                  <button onClick={() => setNovo(u)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-gm-accent hover:text-gm-accent">Dar acesso</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

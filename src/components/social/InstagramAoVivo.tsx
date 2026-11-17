'use client'

/* eslint-disable @next/next/no-img-element -- imagens vêm do CDN do Instagram, com URLs temporárias */

import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { compacto, num, pct } from '@/lib/trafego'
import type { ContaInstagram, PostInstagram, SnapshotInstagram } from '@/lib/instagram'

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const ROTULO = 'text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400'

function Post({ p }: { p: PostInstagram }) {
  return (
    <a href={p.link} target="_blank" rel="noreferrer" className="group block min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
        {p.imagem && <img src={p.imagem} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{p.formato}</span>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-slate-900 tabular-nums">{num(p.interacoes)} interações</p>
      <p className="text-[11px] text-slate-500 tabular-nums">
        {p.alcance != null ? `${compacto(p.alcance)} de alcance` : `${num(p.curtidas)} curtidas`}
      </p>
    </a>
  )
}

export function InstagramAoVivo({ clienteId }: { clienteId: string }) {
  const [estado, setEstado] = useState<'carregando' | 'sem_vinculo' | 'ok' | 'erro'>('carregando')
  const [snap, setSnap] = useState<SnapshotInstagram | null>(null)
  const [erro, setErro] = useState('')
  const [contas, setContas] = useState<ContaInstagram[] | null>(null)
  const [escolha, setEscolha] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('carregando')
    setErro('')
    const res = await api(`/api/instagram/cliente/${clienteId}`)
    const corpo = await res.json().catch(() => ({}))
    if (res.ok && corpo.vinculado === false) {
      setEstado('sem_vinculo')
      if (contas === null) {
        api('/api/instagram/contas').then(r => r.json()).then(d => setContas(d.contas ?? [])).catch(() => setContas([]))
      }
    } else if (res.ok) {
      setSnap(corpo.snapshot)
      setEstado('ok')
    } else {
      // Coluna ainda não criada no banco: trata como sem vínculo.
      if (/instagram_user_id/.test(corpo.error ?? '')) {
        setErro('Rode a migração “Instagram do cliente” do final de supabase/schema.sql para vincular contas.')
        setEstado('sem_vinculo')
      } else {
        setErro(corpo.error || 'Falha ao consultar o Instagram.')
        setEstado('erro')
      }
    }
  }, [clienteId, contas])

  useEffect(() => { carregar() }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function vincular(igId: string | null) {
    setSalvando(true)
    const res = await api(`/api/clientes-fixos/${clienteId}`, { method: 'PATCH', body: JSON.stringify({ instagram_user_id: igId }) })
    setSalvando(false)
    if (!res.ok) {
      setErro('Não foi possível salvar o vínculo.')
      return
    }
    setEscolha('')
    carregar()
  }

  if (estado === 'carregando') {
    return <div className={clsx(CARD, 'h-40 animate-pulse bg-slate-100/60')} aria-label="Carregando Instagram" />
  }

  if (estado === 'sem_vinculo') {
    return (
      <div className={clsx(CARD, 'p-4 md:p-6')}>
        <p className={ROTULO}>Instagram ao vivo</p>
        <p className="mt-1 text-sm text-slate-600">
          Vincule o Instagram do cliente para a IA usar alcance, engajamento e os posts que mais funcionaram ao criar pautas, roteiros e planos.
        </p>
        {erro && <p className="mt-2 text-xs text-amber-700">{erro}</p>}
        {contas && contas.length > 0 ? (
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <select
              value={escolha}
              onChange={e => setEscolha(e.target.value)}
              aria-label="Conta do Instagram"
              className="flex-1 min-w-[220px] text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Selecione a conta…</option>
              {contas.map(c => <option key={c.id} value={c.id}>@{c.username} · {compacto(c.seguidores)} seguidores · página {c.pagina}</option>)}
            </select>
            <button
              onClick={() => vincular(escolha)}
              disabled={!escolha || salvando}
              className="rounded-lg bg-gm-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Vincular
            </button>
          </div>
        ) : contas ? (
          <p className="mt-3 text-xs text-slate-500">
            Nenhuma conta do Instagram visível para o token do Meta. A conta precisa ser Comercial ou Criador, estar ligada a uma página do Facebook
            do Business Manager e o System User precisa das permissões instagram_basic, instagram_manage_insights e pages_read_engagement.
          </p>
        ) : null}
      </div>
    )
  }

  if (estado === 'erro' || !snap) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-semibold">Não foi possível ler o Instagram</p>
        <p className="mt-1">{erro}</p>
        <div className="mt-2 flex gap-3 text-xs font-semibold">
          <button onClick={carregar} className="underline">Tentar de novo</button>
          <button onClick={() => vincular(null)} className="underline">Desvincular</button>
        </div>
      </div>
    )
  }

  const p = snap.perfil
  const numeros = [
    { rotulo: 'Seguidores', valor: compacto(p.seguidores) },
    { rotulo: 'Posts em 30 dias', valor: num(snap.postsUltimos30d) },
    { rotulo: 'Alcance médio', valor: snap.alcanceMedio != null ? compacto(snap.alcanceMedio) : '—' },
    { rotulo: 'Engajamento', valor: snap.taxaEngajamento != null ? pct(snap.taxaEngajamento) : '—', nota: 'interações ÷ alcance' },
  ]

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {p.foto && <img src={p.foto} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-gm-accent/30" />}
          <div className="min-w-0">
            <p className={ROTULO}>Instagram ao vivo</p>
            <a href={`https://instagram.com/${p.username}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 hover:underline">@{p.username}</a>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> a IA usa estes dados</span>
          <button onClick={carregar} className="text-slate-500 hover:text-slate-800">Atualizar</button>
          <button onClick={() => confirm('Desvincular este Instagram do cliente?') && vincular(null)} className="text-slate-400 hover:text-rose-600">Desvincular</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {numeros.map(n => (
          <div key={n.rotulo} className="rounded-xl bg-slate-50 p-3 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">{n.rotulo}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{n.valor}</p>
            {n.nota && <p className="text-[11px] text-slate-400">{n.nota}</p>}
          </div>
        ))}
      </div>

      {snap.porFormato.length > 0 && (
        <div className="mt-4">
          <p className={ROTULO}>Formatos · interações médias por post</p>
          <div className="mt-2 space-y-1.5">
            {snap.porFormato.map(f => {
              const max = snap.porFormato[0].interacoesMedias || 1
              return (
                <div key={f.formato} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-700">{f.formato} <span className="text-slate-400">({f.posts})</span></span>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gm-accent to-gm-glow" style={{ width: `${(f.interacoesMedias / max) * 100}%` }} />
                  </div>
                  <span className="font-semibold tabular-nums text-slate-900">{num(f.interacoesMedias)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {snap.melhores.length > 0 && (
        <div className="mt-5">
          <p className={ROTULO}>Posts que mais engajaram</p>
          <div className="mt-2 grid grid-cols-3 gap-3 max-w-md">
            {snap.melhores.map(x => <Post key={x.id} p={x} />)}
          </div>
        </div>
      )}

      {snap.avisos.length > 0 && <p className="mt-4 text-xs text-amber-700">{snap.avisos.join(' ')}</p>}
    </div>
  )
}

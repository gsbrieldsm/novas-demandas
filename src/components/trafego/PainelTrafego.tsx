'use client'

import { useState } from 'react'
import clsx from 'clsx'
import {
  OBJETIVO_LABEL,
  SITUACAO_LABEL,
  brl,
  compacto,
  custoPor,
  dataBR,
  num,
  pct,
  type Campanha,
  type DadosTrafego,
  type Metricas,
  type SerieDia,
  type SituacaoCampanha,
} from '@/lib/trafego'

// Painel de métricas usado no admin (/admin/trafego) e no link do cliente
// (/trafego/[token]). Só apresenta dados; quem busca é a página.

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const ROTULO = 'text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400'

function Kpi({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: 'bom' | 'ruim' }) {
  return (
    <div className={clsx(CARD, 'p-4 min-w-0')}>
      <p className={clsx(ROTULO, 'truncate')}>{rotulo}</p>
      <p
        className={clsx(
          'mt-1.5 text-xl md:text-2xl font-bold tabular-nums tracking-tight font-[family-name:var(--font-display)]',
          destaque === 'ruim' ? 'text-rose-600' : destaque === 'bom' ? 'text-emerald-600' : 'text-slate-900'
        )}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-slate-500 truncate">{nota}</p>}
    </div>
  )
}

export function Kpis({ m }: { m: Metricas }) {
  const roas = m.investimento > 0 ? m.receita / m.investimento : 0
  const itens: React.ComponentProps<typeof Kpi>[] = [
    { rotulo: 'Investimento', valor: brl(m.investimento), nota: `CPM ${brl(m.cpm)}` },
    { rotulo: 'Alcance', valor: compacto(m.alcance), nota: `${compacto(m.impressoes)} impressões` },
    { rotulo: 'Cliques no link', valor: num(m.cliquesLink), nota: `${custoPor(m.investimento, m.cliquesLink)} por clique` },
    { rotulo: 'Taxa de cliques', valor: pct(m.ctr), nota: 'cliques ÷ impressões' },
    { rotulo: 'Visitas ao site', valor: num(m.visitas), nota: `${custoPor(m.investimento, m.visitas)} por visita` },
    { rotulo: 'Carrinhos', valor: num(m.carrinho), nota: `${custoPor(m.investimento, m.carrinho)} por carrinho` },
    { rotulo: 'Compras', valor: num(m.compras), nota: `${custoPor(m.investimento, m.compras)} por venda` },
    m.receita > 0
      ? { rotulo: 'Retorno (ROAS)', valor: `${roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`, nota: `${brl(m.receita)} em vendas`, destaque: roas >= 1 ? 'bom' : 'ruim' }
      : { rotulo: 'Conversas iniciadas', valor: num(m.conversas), nota: `${custoPor(m.investimento, m.conversas)} por conversa` },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {itens.map(k => <Kpi key={k.rotulo} {...k} />)}
    </div>
  )
}

export function Funil({ m }: { m: Metricas }) {
  const etapas = [
    { rotulo: 'Visitaram o site', valor: m.visitas },
    { rotulo: 'Adicionaram ao carrinho', valor: m.carrinho },
    { rotulo: 'Iniciaram o pagamento', valor: m.checkout },
    { rotulo: 'Compraram', valor: m.compras },
  ]
  const topo = Math.max(etapas[0].valor, 1)
  // Escala de raiz quadrada para as etapas pequenas continuarem visíveis.
  const largura = (v: number) => (v > 0 ? Math.max(Math.sqrt(v / topo) * 100, 2) : 0)

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <p className={ROTULO}>Funil de compra</p>
      <div className="mt-4 space-y-1">
        {etapas.map((e, i) => {
          const anterior = etapas[i - 1]?.valor ?? 0
          const taxa = i > 0 && anterior > 0 ? (e.valor / anterior) * 100 : null
          return (
            <div key={e.rotulo}>
              {i > 0 && (
                <p className="pl-1 md:pl-[168px] py-1 text-xs text-slate-500">
                  ↓ {taxa == null ? '—' : <b className={clsx('font-semibold', taxa < 20 ? 'text-rose-600' : 'text-emerald-600')}>{pct(taxa)}</b>} seguiram para a próxima etapa
                </p>
              )}
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[160px_1fr_64px] items-center gap-x-3 gap-y-1">
                <p className="text-sm text-slate-700">{e.rotulo}</p>
                <p className="md:order-last text-right text-lg font-bold tabular-nums text-slate-900">{num(e.valor)}</p>
                <div className="col-span-2 md:col-span-1 h-3 md:h-7 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-gradient-to-r from-gm-accent to-gm-glow transition-[width] duration-700"
                    style={{ width: `${largura(e.valor)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-slate-400">Barras em escala de raiz quadrada para as etapas menores continuarem visíveis.</p>
    </div>
  )
}

export function GraficoDiario({ serie }: { serie: SerieDia[] }) {
  const [foco, setFoco] = useState<number | null>(null)
  if (serie.length === 0) return null
  const max = Math.max(...serie.map(d => d.investimento), 1)
  const total = serie.reduce((s, d) => s + d.investimento, 0)
  const atual = foco != null ? serie[foco] : null

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Investimento por dia</p>
          <p className="mt-1 text-sm text-slate-500">
            {atual
              ? <>{dataBR(atual.data)} · <b className="text-slate-900">{brl(atual.investimento)}</b> · {num(atual.cliquesLink)} cliques · {num(atual.visitas)} visitas · {num(atual.compras)} compras</>
              : <>Total de <b className="text-slate-900">{brl(total)}</b> em {serie.length} dias. Passe o mouse nas barras para ver o dia.</>}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-[3px] h-40" onMouseLeave={() => setFoco(null)}>
        {serie.map((d, i) => (
          <button
            key={d.data}
            type="button"
            onMouseEnter={() => setFoco(i)}
            onFocus={() => setFoco(i)}
            onClick={() => setFoco(i)}
            aria-label={`${dataBR(d.data)}: ${brl(d.investimento)}`}
            className="group flex-1 h-full flex items-end min-w-0"
          >
            <span
              className={clsx(
                'w-full rounded-t-[4px] transition-colors',
                foco === i ? 'bg-gm-glow' : d.compras > 0 ? 'bg-gm-accent' : 'bg-gm-accent/45 group-hover:bg-gm-accent/70'
              )}
              style={{ height: `${Math.max((d.investimento / max) * 100, d.investimento > 0 ? 3 : 1)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400 tabular-nums">
        <span>{dataBR(serie[0].data)}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-gm-accent" /> dia com venda</span>
        <span>{dataBR(serie[serie.length - 1].data)}</span>
      </div>
    </div>
  )
}

const SITUACAO_COR: Record<SituacaoCampanha, string> = {
  rodando: 'bg-emerald-100 text-emerald-700',
  sem_entrega: 'bg-rose-100 text-rose-700',
  pausada: 'bg-slate-100 text-slate-600',
  encerrada: 'bg-slate-100 text-slate-500',
}

function Situacao({ s }: { s: SituacaoCampanha }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', SITUACAO_COR[s])}>
      {s === 'rodando' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {SITUACAO_LABEL[s]}
    </span>
  )
}

function orcamento(c: Campanha) {
  if (c.orcamentoDiario) return `${brl(c.orcamentoDiario, 0)}/dia`
  if (c.orcamentoTotal) return `${brl(c.orcamentoTotal, 0)} total`
  return '—'
}

export function TabelaCampanhas({ campanhas }: { campanhas: Campanha[] }) {
  const semEntrega = campanhas.filter(c => c.situacao === 'sem_entrega')

  return (
    <div className={clsx(CARD, 'overflow-hidden')}>
      <div className="p-4 md:p-6 pb-3 md:pb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Campanhas</p>
          <p className="mt-1 text-sm text-slate-500">O que está no ar agora e o que teve investimento no período</p>
        </div>
        <p className="text-xs text-slate-500">
          <b className="text-slate-900">{campanhas.filter(c => c.situacao === 'rodando').length}</b> rodando agora
        </p>
      </div>

      {semEntrega.length > 0 && (
        <div role="alert" className="mx-4 md:mx-6 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <b>{semEntrega.length === 1 ? 'Uma campanha ativa' : `${semEntrega.length} campanhas ativas`} sem veiculação nos últimos 3 dias:</b>{' '}
          {semEntrega.map(c => c.nome).join(', ')}.
        </div>
      )}

      {campanhas.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-slate-500">Nenhuma campanha no ar ou com investimento neste período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="text-left font-semibold px-4 md:px-6 py-2.5">Campanha</th>
                <th className="text-right font-semibold px-3 py-2.5">Orçamento</th>
                <th className="text-right font-semibold px-3 py-2.5">Investido</th>
                <th className="text-right font-semibold px-3 py-2.5">CTR</th>
                <th className="text-right font-semibold px-3 py-2.5">Visitas</th>
                <th className="text-right font-semibold px-3 py-2.5">Carrinhos</th>
                <th className="text-right font-semibold px-3 py-2.5">Compras</th>
                <th className="text-right font-semibold px-4 md:px-6 py-2.5">Custo / visita</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map(c => {
                const m = c.metricas
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="px-4 md:px-6 py-3 max-w-[320px]">
                      <p className="font-medium text-slate-900 truncate" title={c.nome}>{c.nome}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <Situacao s={c.situacao} />
                        <span className="text-[11px] text-slate-400">
                          {OBJETIVO_LABEL[c.objetivo] ?? c.objetivo}
                          {c.inicio && ` · ${dataBR(c.inicio)}${c.fim ? ` → ${dataBR(c.fim)}` : ''}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600 whitespace-nowrap">{orcamento(c)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">{m ? brl(m.investimento) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{m ? pct(m.ctr) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{m ? num(m.visitas) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{m ? num(m.carrinho) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{m ? num(m.compras) : '—'}</td>
                    <td className="px-4 md:px-6 py-3 text-right tabular-nums text-slate-600 whitespace-nowrap">{m ? custoPor(m.investimento, m.visitas) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function PainelTrafego({ dados }: { dados: DadosTrafego }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {dados.resumo ? (
        <>
          <Kpis m={dados.resumo} />
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Funil m={dados.resumo} />
            <GraficoDiario serie={dados.serie} />
          </div>
        </>
      ) : (
        <div className={clsx(CARD, 'p-6 text-sm text-slate-500')}>Nenhum investimento neste período.</div>
      )}
      <TabelaCampanhas campanhas={dados.campanhas} />
    </div>
  )
}

export function SkeletonPainel() {
  return (
    <div className="space-y-4 md:space-y-6 animate-pulse" aria-label="Carregando métricas">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[92px] rounded-2xl bg-slate-200/60" />)}
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-200/60" />
        <div className="h-72 rounded-2xl bg-slate-200/60" />
      </div>
    </div>
  )
}

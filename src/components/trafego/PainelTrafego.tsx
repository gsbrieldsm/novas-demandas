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
  razao,
  variacao,
  type Campanha,
  type DadosTrafego,
  type Metricas,
  type MetasTrafego,
  type SerieDia,
  type SituacaoCampanha,
} from '@/lib/trafego'

// Painel de métricas usado no admin (/admin/trafego) e no link do cliente
// (/trafego/[token]). Só apresenta dados; quem busca é a página.

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const ROTULO = 'text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400'

/** Para onde a métrica precisa andar para ser boa notícia. */
type Sentido = 'sobe' | 'desce' | 'neutro'

function Variacao({ v, sentido }: { v: number | null; sentido: Sentido }) {
  if (v == null || !isFinite(v)) return <span className="text-slate-300">sem comparação</span>
  const bom = sentido === 'neutro' ? null : (v > 0) === (sentido === 'sobe')
  const quase = Math.abs(v) < 1
  return (
    <span
      className={clsx(
        'font-semibold tabular-nums',
        quase || bom == null ? 'text-slate-500' : bom ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {quase ? '=' : v > 0 ? '▲' : '▼'} {Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 })}%
    </span>
  )
}

interface KpiProps {
  rotulo: string
  valor: string
  nota?: string
  destaque?: 'bom' | 'ruim'
  delta?: { v: number | null; sentido: Sentido }
  meta?: string
}

function Kpi({ rotulo, valor, nota, destaque, delta, meta }: KpiProps) {
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
      {(delta || meta) && (
        <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400 truncate">
          {delta && <><Variacao {...delta} /> vs. anterior</>}
          {delta && meta && ' · '}
          {meta}
        </p>
      )}
    </div>
  )
}

const vezes = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`

/** "bom" quando o valor bate a meta (para custo, ficar abaixo; para ROAS, acima). */
function contraMeta(valor: number | null, meta: number | null | undefined, sentido: 'sobe' | 'desce') {
  if (valor == null || !meta) return undefined
  return (sentido === 'sobe' ? valor >= meta : valor <= meta) ? 'bom' : 'ruim'
}

export function Kpis({ m, anterior, metas }: { m: Metricas; anterior?: Metricas | null; metas?: MetasTrafego | null }) {
  const a = anterior ?? null
  const d = (atual: number | null, ant: number | null | undefined, sentido: Sentido) =>
    a ? { v: atual == null ? null : variacao(atual, ant), sentido } : undefined

  const cpc = razao(m.investimento, m.cliquesLink)
  const cpv = razao(m.investimento, m.visitas)
  const cpa = razao(m.investimento, m.compras)
  const roas = razao(m.receita, m.investimento)
  const cpConversa = razao(m.investimento, m.conversas)

  const itens: KpiProps[] = [
    { rotulo: 'Investimento', valor: brl(m.investimento), nota: `CPM ${brl(m.cpm)}`, delta: d(m.investimento, a?.investimento, 'neutro') },
    { rotulo: 'Alcance', valor: compacto(m.alcance), nota: `${compacto(m.impressoes)} impressões`, delta: d(m.alcance, a?.alcance, 'sobe') },
    { rotulo: 'Cliques no link', valor: num(m.cliquesLink), nota: `${custoPor(m.investimento, m.cliquesLink)} por clique`, delta: d(cpc, a && razao(a.investimento, a.cliquesLink), 'desce') },
    { rotulo: 'Taxa de cliques', valor: pct(m.ctr), nota: 'cliques ÷ impressões', delta: d(m.ctr, a?.ctr, 'sobe') },
    { rotulo: 'Visitas ao site', valor: num(m.visitas), nota: `${custoPor(m.investimento, m.visitas)} por visita`, delta: d(cpv, a && razao(a.investimento, a.visitas), 'desce') },
    { rotulo: 'Carrinhos', valor: num(m.carrinho), nota: `${custoPor(m.investimento, m.carrinho)} por carrinho`, delta: d(m.carrinho, a?.carrinho, 'sobe') },
    {
      rotulo: 'Compras',
      valor: num(m.compras),
      nota: `${custoPor(m.investimento, m.compras)} por venda`,
      delta: d(cpa, a && razao(a.investimento, a.compras), 'desce'),
      meta: metas?.custo_compra ? `meta ${brl(metas.custo_compra)}/venda` : undefined,
      destaque: contraMeta(cpa, metas?.custo_compra, 'desce'),
    },
    m.receita > 0
      ? {
          rotulo: 'Retorno (ROAS)',
          valor: vezes(roas ?? 0),
          nota: `${brl(m.receita)} em vendas`,
          delta: d(roas, a && razao(a.receita, a.investimento), 'sobe'),
          meta: metas?.roas ? `meta ${vezes(metas.roas)}` : undefined,
          destaque: contraMeta(roas, metas?.roas, 'sobe') ?? ((roas ?? 0) >= 1 ? 'bom' : 'ruim'),
        }
      : {
          rotulo: 'Conversas iniciadas',
          valor: num(m.conversas),
          nota: `${custoPor(m.investimento, m.conversas)} por conversa`,
          delta: d(cpConversa, a && razao(a.investimento, a.conversas), 'desce'),
          meta: metas?.custo_conversa ? `meta ${brl(metas.custo_conversa)}/conversa` : undefined,
          destaque: contraMeta(cpConversa, metas?.custo_conversa, 'desce'),
        },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {itens.map(k => <Kpi key={k.rotulo} {...k} />)}
    </div>
  )
}

/** Verba do mês: quanto já foi, ritmo ideal e projeção de fechamento. */
export function RitmoVerba({ mes, verba }: { mes: DadosTrafego['mes']; verba: number }) {
  const ideal = (verba * mes.dia) / mes.diasNoMes
  const projecao = mes.dia > 0 ? (mes.investimento / mes.dia) * mes.diasNoMes : 0
  const desvio = ideal > 0 ? ((mes.investimento - ideal) / ideal) * 100 : 0
  const usado = Math.min((mes.investimento / verba) * 100, 100)
  const marcaIdeal = Math.min((ideal / verba) * 100, 100)
  const status =
    Math.abs(desvio) <= 10
      ? { txt: 'No ritmo', cor: 'text-emerald-600 bg-emerald-50' }
      : desvio > 0
        ? { txt: `Gastando ${Math.round(desvio)}% acima do ritmo`, cor: 'text-rose-600 bg-rose-50' }
        : { txt: `Gastando ${Math.round(-desvio)}% abaixo do ritmo`, cor: 'text-amber-700 bg-amber-50' }

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Verba do mês</p>
          <p className="mt-1 text-sm text-slate-500">
            <b className="text-slate-900 tabular-nums">{brl(mes.investimento)}</b> de {brl(verba, 0)} · dia {mes.dia} de {mes.diasNoMes}
          </p>
        </div>
        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', status.cor)}>{status.txt}</span>
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-gm-accent to-gm-glow" style={{ width: `${usado}%` }} />
        <span
          className="absolute -top-1 h-5 w-0.5 rounded bg-slate-900/70"
          style={{ left: `${marcaIdeal}%` }}
          title={`Ritmo ideal hoje: ${brl(ideal, 0)}`}
        />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500 flex-wrap">
        <span>Ideal até hoje: <b className="text-slate-700 tabular-nums">{brl(ideal, 0)}</b></span>
        <span>
          Fecha o mês em <b className={clsx('tabular-nums', projecao > verba * 1.05 ? 'text-rose-600' : 'text-slate-700')}>{brl(projecao, 0)}</b> neste ritmo
        </span>
      </div>
    </div>
  )
}

// ─── Tabela diária com mapa de calor ─────────────────────────────────────────

interface LinhaMatriz {
  rotulo: string
  valor: (m: Metricas) => number | null
  fmt: (v: number) => string
  /** Sem sentido = só mostra o número, sem cor. */
  sentido?: 'sobe' | 'desce'
  meta?: number | null
}

function mediana(xs: number[]) {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const meio = Math.floor(s.length / 2)
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2
}

/** Cor da célula pela distância até a referência (meta ou mediana do período). */
function corCelula(v: number | null, ref: number | null, sentido?: 'sobe' | 'desce') {
  if (v == null || ref == null || ref === 0 || !sentido) return ''
  const desvio = ((v - ref) / ref) * (sentido === 'sobe' ? 1 : -1)
  if (desvio >= 0.3) return 'bg-emerald-200/80 text-emerald-900'
  if (desvio >= 0.1) return 'bg-emerald-100/80 text-emerald-800'
  if (desvio <= -0.3) return 'bg-rose-200/80 text-rose-900'
  if (desvio <= -0.1) return 'bg-rose-100/80 text-rose-800'
  return ''
}

export function MatrizDiaria({ serie, total, metas }: { serie: SerieDia[]; total: Metricas; metas?: MetasTrafego | null }) {
  const dias = [...serie].reverse() // mais recente primeiro
  const temVenda = total.compras > 0 || total.receita > 0
  const temConversa = total.conversas > 0

  const linhas: LinhaMatriz[] = [
    { rotulo: 'Investimento', valor: m => m.investimento, fmt: v => brl(v) },
    { rotulo: 'Impressões', valor: m => m.impressoes, fmt: num },
    { rotulo: 'CPM', valor: m => (m.impressoes > 0 ? m.cpm : null), fmt: v => brl(v), sentido: 'desce' },
    { rotulo: 'Cliques no link', valor: m => m.cliquesLink, fmt: num },
    { rotulo: 'CPC', valor: m => razao(m.investimento, m.cliquesLink), fmt: v => brl(v), sentido: 'desce' },
    { rotulo: 'CTR', valor: m => (m.impressoes > 0 ? m.ctr : null), fmt: v => pct(v, 2), sentido: 'sobe' },
    { rotulo: 'Visitas ao site', valor: m => m.visitas, fmt: num },
    { rotulo: 'Custo / visita', valor: m => razao(m.investimento, m.visitas), fmt: v => brl(v), sentido: 'desce' },
    { rotulo: 'Taxa de chegada', valor: m => (m.cliquesLink > 0 ? (m.visitas / m.cliquesLink) * 100 : null), fmt: v => pct(v), sentido: 'sobe' },
    ...(temVenda
      ? ([
          { rotulo: 'Carrinhos', valor: m => m.carrinho, fmt: num },
          { rotulo: 'Compras', valor: m => m.compras, fmt: num },
          { rotulo: 'Custo / compra', valor: m => razao(m.investimento, m.compras), fmt: v => brl(v), sentido: 'desce', meta: metas?.custo_compra },
          { rotulo: 'ROAS', valor: m => (m.investimento > 0 ? m.receita / m.investimento : null), fmt: vezes, sentido: 'sobe', meta: metas?.roas },
        ] satisfies LinhaMatriz[])
      : []),
    ...(temConversa
      ? ([
          { rotulo: 'Conversas', valor: m => m.conversas, fmt: num },
          { rotulo: 'Custo / conversa', valor: m => razao(m.investimento, m.conversas), fmt: v => brl(v), sentido: 'desce', meta: metas?.custo_conversa },
        ] satisfies LinhaMatriz[])
      : []),
  ]

  if (dias.length === 0) return null

  return (
    <div className={clsx(CARD, 'overflow-hidden')}>
      <div className="p-4 md:p-6 pb-3 md:pb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Dia a dia</p>
          <p className="mt-1 text-sm text-slate-500">Verde: dia melhor que a referência. Vermelho: pior. Referência é a meta do cliente quando existe; se não, a mediana do período.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-3 w-5 rounded bg-rose-200/80" /><span className="h-3 w-5 rounded bg-rose-100/80" />
          <span className="px-1">pior · melhor</span>
          <span className="h-3 w-5 rounded bg-emerald-100/80" /><span className="h-3 w-5 rounded bg-emerald-200/80" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full text-xs tabular-nums">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
              <th className="sticky left-0 z-10 bg-slate-50 text-left font-semibold px-4 md:px-6 py-2.5 min-w-[140px]">Métrica</th>
              <th className="text-right font-semibold px-3 py-2.5 bg-slate-100/70 text-slate-500">Período</th>
              {dias.map(dia => (
                <th key={dia.data} className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">{dataBR(dia.data)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => {
              const valores = dias.map(dia => (dia.investimento > 0 ? l.valor(dia) : null))
              const ref = l.meta || mediana(valores.filter((v): v is number => v != null))
              const vTotal = l.valor(total)
              return (
                <tr key={l.rotulo} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-white text-left font-medium text-slate-700 px-4 md:px-6 py-2 whitespace-nowrap">
                    {l.rotulo}
                    {l.meta ? <span className="ml-1.5 text-[10px] font-normal text-slate-400">meta {l.fmt(l.meta)}</span> : null}
                  </th>
                  <td className={clsx('text-right px-3 py-2 font-semibold whitespace-nowrap bg-slate-50/70', l.meta ? corCelula(vTotal, l.meta, l.sentido) : 'text-slate-900')}>
                    {vTotal == null ? '—' : l.fmt(vTotal)}
                  </td>
                  {valores.map((v, i) => (
                    <td key={dias[i].data} className={clsx('text-right px-3 py-2 whitespace-nowrap text-slate-600', corCelula(v, ref, l.sentido))}>
                      {v == null ? '—' : l.fmt(v)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

/** `metas` só é passado no admin; o link público mostra o painel sem as metas da agência. */
export function PainelTrafego({ dados, metas }: { dados: DadosTrafego; metas?: MetasTrafego | null }) {
  const ant = dados.intervaloAnterior
  return (
    <div className="space-y-4 md:space-y-6">
      {metas?.verba_mensal ? <RitmoVerba mes={dados.mes} verba={metas.verba_mensal} /> : null}
      {dados.resumo ? (
        <>
          <Kpis m={dados.resumo} anterior={dados.anterior} metas={metas} />
          {dados.anterior && ant && (
            <p className="-mt-2 md:-mt-4 text-[11px] text-slate-400">
              Comparado com {dataBR(ant.inicio)} a {dataBR(ant.fim)} · nos custos, ▼ é bom
            </p>
          )}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Funil m={dados.resumo} />
            <GraficoDiario serie={dados.serie} />
          </div>
          <MatrizDiaria serie={dados.serie} total={dados.resumo} metas={metas} />
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

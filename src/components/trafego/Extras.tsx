'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { brl, num, pct, razao, type CelulaHora, type Criativo, type Metricas, type PerfilAnuncios, type Regiao } from '@/lib/trafego'
import { BRASIL_VIEWBOX, UF_CENTROS, UF_PATHS } from './brasil-uf'

// Blocos visuais extras do painel de tráfego: criativos (com alerta de
// fadiga), mapa do Brasil por estado e mapa de calor dia da semana × hora.

const CARD = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const ROTULO = 'text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-400'

/** Cor de destaque do tema (--gm-accent) com intensidade variável. */
const tom = (k: number) => `rgb(124 108 255 / ${(0.1 + 0.9 * Math.max(0, Math.min(1, k))).toFixed(3)})`

// ─── Resultado principal da conta ────────────────────────────────────────────

type ChaveResultado = 'compras' | 'conversas' | 'visitas' | 'cliquesLink'
interface Resultado { chave: ChaveResultado; plural: string; singular: string }

/**
 * O que conta como "resultado": vendas quando existem; se não, o que tiver mais
 * volume entre conversas e visitas (uma conversa solta não vira o objetivo da conta).
 */
export function resultadoPrincipal(m: Metricas): Resultado {
  if (m.compras > 0) return { chave: 'compras', plural: 'vendas', singular: 'venda' }
  if (m.conversas > 0 && m.conversas >= m.visitas) return { chave: 'conversas', plural: 'conversas', singular: 'conversa' }
  return { chave: 'visitas', plural: 'visitas', singular: 'visita' }
}

function Abas<T extends string>({ opcoes, valor, onChange }: { opcoes: { id: T; label: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs" role="tablist">
      {opcoes.map(o => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            valor === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Criativos ───────────────────────────────────────────────────────────────

function BarraTaxa({ rotulo, valor, dica }: { rotulo: string; valor: number | null; dica: string }) {
  return (
    <div title={dica}>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{rotulo}</span>
        <b className="tabular-nums text-slate-700">{valor == null ? '—' : pct(valor * 100, 0)}</b>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-gm-accent to-gm-glow" style={{ width: `${Math.min((valor ?? 0) * 100, 100)}%` }} />
      </div>
    </div>
  )
}

function Numero({ rotulo, valor, dica }: { rotulo: string; valor: number | null; dica?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5" title={dica}>
      <p className="text-[11px] text-slate-500">{rotulo}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{valor == null ? '—' : num(valor)}</p>
    </div>
  )
}

/** Engajamento que os anúncios trouxeram + o que aconteceu no perfil do Instagram. */
function ResumoEngajamento({ total, perfil }: { total: Metricas; perfil?: PerfilAnuncios }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Numero rotulo="Curtidas e reações" valor={total.reacoes} dica="Reações nos anúncios (Facebook e Instagram)" />
        <Numero rotulo="Comentários" valor={total.comentarios} />
        <Numero rotulo="Compartilhamentos" valor={total.compartilhamentos} />
        <Numero rotulo="Salvamentos" valor={total.salvamentos} />
        <Numero rotulo="Engajamento total" valor={total.engajamento} dica="Todas as interações com os anúncios, incluindo visualizações de vídeo e cliques" />
        <Numero rotulo="Cadastros" valor={total.cadastros} dica="Cadastros completos registrados pelo pixel" />
      </div>
      {perfil && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            {perfil.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs">IG</span>
            )}
            <span className="font-medium text-slate-900">@{perfil.username}</span>
          </div>
          <span className="text-slate-500"><b className="tabular-nums text-slate-900">{num(perfil.seguidores)}</b> seguidores</span>
          {perfil.novosSeguidores != null && (
            <span className="text-slate-500">
              <b className="tabular-nums text-emerald-600">+{num(perfil.novosSeguidores)}</b> novos
              {perfil.deixaramDeSeguir ? <span className="text-slate-400"> · {num(perfil.deixaramDeSeguir)} deixaram</span> : null}
            </span>
          )}
          {perfil.visitasPerfil != null && <span className="text-slate-500"><b className="tabular-nums text-slate-900">{num(perfil.visitasPerfil)}</b> visitas ao perfil</span>}
          {perfil.alcance != null && <span className="text-slate-500"><b className="tabular-nums text-slate-900">{num(perfil.alcance)}</b> contas alcançadas</span>}
          {perfil.novosSeguidores == null && perfil.visitasPerfil == null && (
            <span className="text-xs text-slate-400">Métricas do perfil indisponíveis para esta conta.</span>
          )}
          <span className="ml-auto text-[11px] text-slate-400">Perfil: orgânico + anúncios no período</span>
        </div>
      )}
    </div>
  )
}

type FiltroCriativos = 'no_ar' | 'todos'
const POR_PAGINA = 12

export function Criativos({ criativos, total, perfil, interno }: { criativos: Criativo[]; total: Metricas; perfil?: PerfilAnuncios; interno?: boolean }) {
  const res = resultadoPrincipal(total)
  const custo = (c: Criativo) => (c.metricas[res.chave] > 0 ? c.metricas.investimento / c.metricas[res.chave] : null)
  const noAr = criativos.filter(c => c.rodando)
  const [filtro, setFiltro] = useState<FiltroCriativos>(noAr.length ? 'no_ar' : 'todos')
  const [limite, setLimite] = useState(POR_PAGINA)
  const lista = filtro === 'no_ar' ? noAr : criativos
  const visiveis = lista.slice(0, limite)

  // "Melhor custo" só faz sentido comparando pelo menos dois com resultado.
  const comResultado = criativos.filter(c => custo(c) != null)
  const melhor = comResultado.length >= 2 ? comResultado.reduce((a, b) => (custo(b)! < custo(a)! ? b : a)).id : null
  const alertas = interno ? criativos.filter(c => c.fadiga) : []

  if (criativos.length === 0) return null

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Criativos e engajamento</p>
          <p className="mt-1 text-sm text-slate-500">Todos os anúncios no ar e os que receberam verba no período, com o desempenho e o engajamento de cada um.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            Custo comparado por <b className="text-slate-900">{res.singular}</b>
          </p>
          <Abas
            valor={filtro}
            onChange={v => { setFiltro(v); setLimite(POR_PAGINA) }}
            opcoes={[
              { id: 'no_ar', label: `No ar (${noAr.length})` },
              { id: 'todos', label: `Todos (${criativos.length})` },
            ]}
          />
        </div>
      </div>

      <ResumoEngajamento total={total} perfil={perfil} />

      {alertas.length > 0 && (
        <div className="mt-4 space-y-2" role="alert">
          {alertas.map(c => (
            <div
              key={c.id}
              className={clsx(
                'flex items-start gap-2.5 rounded-xl border p-3 text-sm',
                c.fadiga!.nivel === 'trocar' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              )}
            >
              <span className="mt-0.5 text-base leading-none" aria-hidden>{c.fadiga!.nivel === 'trocar' ? '⚠' : '◔'}</span>
              <p>
                <b>{c.fadiga!.nivel === 'trocar' ? 'Hora de trocar' : 'De olho'}: {c.nome}.</b> {c.fadiga!.motivo}.
                {c.fadiga!.ctrAntes != null && (
                  <span className="opacity-75"> CTR do link {pct(c.fadiga!.ctrAntes, 2)} → {pct(c.fadiga!.ctrAgora, 2)}.</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {visiveis.map(c => {
          const m = c.metricas
          const cpr = custo(c)
          const parou = c.tipo === 'video' ? razao(m.videoViews, m.impressoes) : null
          const assistiu = c.tipo === 'video' ? razao(c.thruplays, m.videoViews) : null
          const capa = (
            <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
              {c.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              ) : (
                <div className="grid h-full place-items-center text-xs text-slate-400">sem prévia</div>
              )}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  {c.tipo === 'video' ? '▶ Vídeo' : c.tipo === 'imagem' ? 'Imagem' : 'Anúncio'}
                </span>
                <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur', c.rodando ? 'bg-emerald-500/90 text-white' : 'bg-white/80 text-slate-600')}>
                  {c.rodando ? (m.impressoes > 0 ? 'No ar' : 'No ar · aguardando entrega') : c.ativo ? 'Encerrado' : 'Pausado'}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 p-2">
                {melhor === c.id && <span className="rounded-full bg-gm-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow">★ Melhor custo</span>}
                {interno && c.fadiga && (
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow', c.fadiga.nivel === 'trocar' ? 'bg-rose-600' : 'bg-amber-500')}>
                    {c.fadiga.nivel === 'trocar' ? 'Trocar criativo' : 'Cansando'}
                  </span>
                )}
              </div>
              {c.link && (
                <span className="absolute inset-0 grid place-items-center bg-slate-950/45 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Ver no Instagram ↗
                </span>
              )}
            </div>
          )
          return (
            <article key={c.id} className="group overflow-hidden rounded-xl border border-slate-100 bg-white">
              {c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${c.nome} no Instagram`}>{capa}</a> : capa}
              <div className="p-3 space-y-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900" title={c.nome}>{c.nome}</p>
                  <p className="truncate text-[11px] text-slate-400" title={c.campanha}>{c.campanha}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                  <div><dt className="text-slate-400">Investido</dt><dd className="font-semibold tabular-nums text-slate-900">{brl(m.investimento)}</dd></div>
                  <div><dt className="text-slate-400">CTR do link</dt><dd className="font-semibold tabular-nums text-slate-900">{pct(c.ctrLink, 2)}</dd></div>
                  <div><dt className="text-slate-400 capitalize">{res.plural}</dt><dd className="font-semibold tabular-nums text-slate-900">{num(m[res.chave])}</dd></div>
                  <div><dt className="text-slate-400">Custo/{res.singular}</dt><dd className={clsx('font-semibold tabular-nums', melhor === c.id ? 'text-gm-accent' : 'text-slate-900')}>{cpr == null ? '—' : brl(cpr)}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500" aria-label="Engajamento">
                  <span title="Curtidas e reações">♥ <b className="tabular-nums text-slate-700">{num(m.reacoes)}</b></span>
                  <span title="Comentários">💬 <b className="tabular-nums text-slate-700">{num(m.comentarios)}</b></span>
                  <span title="Compartilhamentos">↗ <b className="tabular-nums text-slate-700">{num(m.compartilhamentos)}</b></span>
                  <span title="Salvamentos">🔖 <b className="tabular-nums text-slate-700">{num(m.salvamentos)}</b></span>
                  <span title="Alcance">👁 <b className="tabular-nums text-slate-700">{num(m.alcance)}</b></span>
                </div>
                {c.tipo === 'video' && (
                  <div className="space-y-1.5 border-t border-slate-100 pt-2">
                    <BarraTaxa rotulo="Pararam para ver" valor={parou} dica="Visualizações de 3 segundos ÷ impressões: quanto o começo do vídeo prende" />
                    <BarraTaxa rotulo="Assistiram até o fim" valor={assistiu} dica="ThruPlays (até o fim ou 15s) ÷ visualizações de 3 segundos" />
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {lista.length === 0 && <p className="mt-4 text-sm text-slate-400">Nenhum anúncio no ar agora.</p>}
      {lista.length > limite && (
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setLimite(l => l + POR_PAGINA)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Mostrar mais ({lista.length - limite})
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mapa do Brasil (contorno real dos estados, malha do IBGE) ───────────────

/** Estados pequenos demais para caber o rótulo dentro. */
const UF_PEQUENAS = new Set(['DF', 'SE', 'AL', 'RN', 'PB', 'ES', 'RJ'])

type MetricaMapa = 'investimento' | 'resultado' | 'custo'

export function MapaBrasil({ regioes, total }: { regioes: Regiao[]; total: Metricas }) {
  // Por privacidade, o Meta não abre visitas e vendas do site por estado; nesse
  // caso o mapa usa cliques no link e avisa.
  const principal = resultadoPrincipal(total)
  const semConversaoPorEstado = regioes.every(r => r.metricas[principal.chave] === 0)
  const res: Resultado = semConversaoPorEstado ? { chave: 'cliquesLink', plural: 'cliques', singular: 'clique' } : principal
  const [metrica, setMetrica] = useState<MetricaMapa>('investimento')
  const [foco, setFoco] = useState<string | null>(null)

  const porUf = useMemo(() => new Map(regioes.filter(r => r.uf).map(r => [r.uf!, r])), [regioes])
  const gasto = regioes.reduce((s, r) => s + r.metricas.investimento, 0)

  const valor = (r?: Regiao) => {
    if (!r) return null
    if (metrica === 'investimento') return r.metricas.investimento
    if (metrica === 'resultado') return r.metricas[res.chave]
    return razao(r.metricas.investimento, r.metricas[res.chave])
  }
  const vals = [...porUf.values()].map(valor).filter((v): v is number => v != null && v > 0)
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, Infinity)
  // Para custo, quanto menor melhor: o mais barato fica mais forte.
  const intensidade = (v: number | null) => (v == null || v <= 0 ? null : metrica === 'custo' ? min / v : v / max)

  const fmt = (v: number | null) => (v == null ? '—' : metrica === 'resultado' ? num(v) : brl(v))
  const atual = foco ? porUf.get(foco) : null

  if (regioes.length === 0) return null

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Onde a verba foi parar</p>
          <p className="mt-1 text-sm text-slate-500">
            Investimento e resultado por estado (o Meta não detalha por cidade).
            {semConversaoPorEstado && <> {principal.plural[0].toUpperCase() + principal.plural.slice(1)} não são informadas por estado, então comparamos cliques no link.</>}
          </p>
        </div>
        <Abas
          valor={metrica}
          onChange={setMetrica}
          opcoes={[
            { id: 'investimento', label: 'Investimento' },
            { id: 'resultado', label: res.plural[0].toUpperCase() + res.plural.slice(1) },
            { id: 'custo', label: `Custo/${res.singular}` },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
        <div className="mx-auto w-full max-w-[380px] md:w-[360px]">
          <svg viewBox={BRASIL_VIEWBOX} className="h-auto w-full" role="img" aria-label="Mapa do Brasil por estado" onMouseLeave={() => setFoco(null)}>
            {Object.entries(UF_PATHS).map(([uf, d]) => {
              const r = porUf.get(uf)
              const k = intensidade(valor(r))
              return (
                <path
                  key={uf}
                  d={d}
                  tabIndex={0}
                  role="button"
                  aria-label={r ? `${r.nome}: ${fmt(valor(r))}` : `${uf}: sem investimento`}
                  onMouseEnter={() => setFoco(uf)}
                  onFocus={() => setFoco(uf)}
                  onClick={() => setFoco(uf)}
                  className="cursor-pointer outline-none transition-[fill,opacity] duration-200"
                  fill={k == null ? 'rgb(241 245 249)' : tom(k)}
                  stroke={foco === uf ? 'rgb(15 23 42)' : 'white'}
                  strokeWidth={foco === uf ? 2 : 1}
                  strokeLinejoin="round"
                  opacity={foco && foco !== uf ? 0.75 : 1}
                />
              )
            })}
            {/* foco por cima para a borda não ficar escondida pelos vizinhos */}
            {foco && UF_PATHS[foco] && (
              <path d={UF_PATHS[foco]} fill="none" stroke="rgb(15 23 42)" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
            )}
            {Object.entries(UF_CENTROS).map(([uf, [x, y]]) => {
              const k = intensidade(valor(porUf.get(uf)))
              if (UF_PEQUENAS.has(uf) && k == null) return null
              return (
                <text
                  key={uf}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                  className="font-semibold"
                  fontSize={UF_PEQUENAS.has(uf) ? 11 : 14}
                  fill={k == null ? 'rgb(148 163 184)' : k > 0.45 ? 'white' : 'rgb(51 65 85)'}
                >
                  {uf}
                </text>
              )
            })}
          </svg>
          <p className="mt-3 min-h-[2.5rem] text-center text-xs text-slate-500">
            {atual ? (
              <>
                <b className="text-slate-900">{atual.nome}</b> · {brl(atual.metricas.investimento)} ({pct(gasto > 0 ? (atual.metricas.investimento / gasto) * 100 : 0, 0)} da verba)
                <br />
                {num(atual.metricas[res.chave])} {res.plural} · {razao(atual.metricas.investimento, atual.metricas[res.chave]) == null ? 'sem resultado' : `${brl(atual.metricas.investimento / atual.metricas[res.chave])} por ${res.singular}`}
              </>
            ) : foco ? (
              <>{foco}: sem investimento no período</>
            ) : (
              <>Passe o mouse em um estado</>
            )}
          </p>
        </div>

        <ol className="space-y-2.5">
          {regioes.slice(0, 8).map(r => {
            const parte = gasto > 0 ? r.metricas.investimento / gasto : 0
            const cpr = razao(r.metricas.investimento, r.metricas[res.chave])
            return (
              <li
                key={r.nome}
                onMouseEnter={() => r.uf && setFoco(r.uf)}
                onMouseLeave={() => setFoco(null)}
                className={clsx('rounded-lg px-2 py-1.5 -mx-2 transition-colors', foco && foco === r.uf && 'bg-slate-50')}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">
                    {r.uf && <b className="mr-1.5 text-[11px] text-slate-400">{r.uf}</b>}
                    {r.nome}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-900">{brl(r.metricas.investimento)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gm-accent to-gm-glow" style={{ width: `${Math.max(parte * 100, 1.5)}%` }} />
                  </div>
                  <span className="w-[150px] shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                    {pct(parte * 100, 0)} · {num(r.metricas[res.chave])} {res.plural}{cpr != null && ` · ${brl(cpr)}`}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// ─── Mapa de calor: dia da semana × hora ─────────────────────────────────────

const DIAS = [
  { d: 1, curto: 'Seg', longo: 'segunda' },
  { d: 2, curto: 'Ter', longo: 'terça' },
  { d: 3, curto: 'Qua', longo: 'quarta' },
  { d: 4, curto: 'Qui', longo: 'quinta' },
  { d: 5, curto: 'Sex', longo: 'sexta' },
  { d: 6, curto: 'Sáb', longo: 'sábado' },
  { d: 0, curto: 'Dom', longo: 'domingo' },
]
const HORAS = Array.from({ length: 24 }, (_, h) => h)

type MetricaHora = 'resultado' | 'investimento' | 'custo' | 'ctr'

/** Janela de 3 horas seguidas com mais resultado no período todo. */
function melhorJanela(porHora: { res: number; inv: number }[]) {
  let melhor = { inicio: 0, res: -1, inv: 0 }
  for (let h = 0; h <= 21; h++) {
    const res = porHora[h].res + porHora[h + 1].res + porHora[h + 2].res
    const inv = porHora[h].inv + porHora[h + 1].inv + porHora[h + 2].inv
    if (res > melhor.res) melhor = { inicio: h, res, inv }
  }
  return melhor
}

export function MapaHoras({ horas, total }: { horas: CelulaHora[]; total: Metricas }) {
  const res = resultadoPrincipal(total)
  const [metrica, setMetrica] = useState<MetricaHora>('resultado')
  const [foco, setFoco] = useState<CelulaHora | null>(null)

  const celula = useMemo(() => new Map(horas.map(c => [`${c.dia}-${c.hora}`, c])), [horas])
  const maxGasto = Math.max(...horas.map(c => c.investimento), 0)

  const valor = (c?: CelulaHora) => {
    if (!c || c.investimento <= 0) return null
    if (metrica === 'investimento') return c.investimento
    if (metrica === 'resultado') return c[res.chave]
    // Taxas e custos com pouquíssima verba enganam: só a partir de 8% do pico.
    if (c.investimento < maxGasto * 0.08) return null
    if (metrica === 'ctr') return c.impressoes > 0 ? (c.cliquesLink / c.impressoes) * 100 : null
    return c[res.chave] > 0 ? c.investimento / c[res.chave] : null
  }
  const vals = horas.map(valor).filter((v): v is number => v != null && v > 0)
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, Infinity)
  const intensidade = (v: number | null) => (v == null || v <= 0 ? null : metrica === 'custo' ? min / v : v / max)
  const fmt = (v: number) => (metrica === 'resultado' ? num(v) : metrica === 'ctr' ? pct(v, 2) : brl(v))

  const porHora = HORAS.map(h => DIAS.reduce((s, { d }) => {
    const c = celula.get(`${d}-${h}`)
    return { res: s.res + (c?.[res.chave] ?? 0), inv: s.inv + (c?.investimento ?? 0) }
  }, { res: 0, inv: 0 }))
  const porDia = DIAS.map(({ d, longo }) => {
    const cs = horas.filter(c => c.dia === d)
    return { longo, res: cs.reduce((s, c) => s + c[res.chave], 0), inv: cs.reduce((s, c) => s + c.investimento, 0) }
  })
  const totRes = porHora.reduce((s, h) => s + h.res, 0)
  const totInv = porHora.reduce((s, h) => s + h.inv, 0)
  const janela = melhorJanela(porHora)
  const melhorDia = porDia.reduce((a, b) => (b.res > a.res ? b : a))

  if (horas.length === 0) return null

  return (
    <div className={clsx(CARD, 'p-4 md:p-6')}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className={ROTULO}>Dia da semana × horário</p>
          <p className="mt-1 text-sm text-slate-500">Quando os anúncios mais rendem, somando o período todo. Horário de Brasília.</p>
        </div>
        <Abas
          valor={metrica}
          onChange={setMetrica}
          opcoes={[
            { id: 'resultado', label: res.plural[0].toUpperCase() + res.plural.slice(1) },
            { id: 'investimento', label: 'Investimento' },
            { id: 'custo', label: `Custo/${res.singular}` },
            { id: 'ctr', label: 'CTR' },
          ]}
        />
      </div>

      {totRes > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <b className="text-slate-900">Melhor janela: {janela.inicio}h às {janela.inicio + 3}h.</b>{' '}
            {pct((janela.res / totRes) * 100, 0)} das {res.plural} com {pct(totInv > 0 ? (janela.inv / totInv) * 100 : 0, 0)} da verba.
          </p>
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <b className="text-slate-900">Melhor dia: {melhorDia.longo}.</b>{' '}
            {num(melhorDia.res)} {res.plural}{melhorDia.res > 0 && ` a ${brl(melhorDia.inv / melhorDia.res)} cada`}.
          </p>
        </div>
      )}

      <p className="mt-4 min-h-[1.25rem] text-xs text-slate-500" aria-live="polite">
        {foco ? (
          <>
            <b className="text-slate-900">{DIAS.find(x => x.d === foco.dia)?.curto} {foco.hora}h</b> · {brl(foco.investimento)} · {num(foco[res.chave])} {res.plural}
            {foco[res.chave] > 0 && ` · ${brl(foco.investimento / foco[res.chave])} por ${res.singular}`}
            {foco.impressoes > 0 && ` · CTR ${pct((foco.cliquesLink / foco.impressoes) * 100, 2)}`}
          </>
        ) : (
          <>Passe o mouse nos quadradinhos para ver cada horário.</>
        )}
      </p>

      <div className="mt-2 overflow-x-auto">
        <div className="min-w-[640px]" onMouseLeave={() => setFoco(null)}>
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px]">
            <span />
            {HORAS.map(h => (
              <span key={h} className="text-center text-[9px] tabular-nums text-slate-400">{h % 3 === 0 ? `${h}h` : ''}</span>
            ))}
            {DIAS.map(({ d, curto }) => (
              <div key={d} className="contents">
                <span className="pr-1 text-right text-[11px] font-medium leading-6 text-slate-500">{curto}</span>
                {HORAS.map(h => {
                  const c = celula.get(`${d}-${h}`)
                  const k = intensidade(valor(c))
                  return (
                    <button
                      key={h}
                      type="button"
                      onMouseEnter={() => c && setFoco(c)}
                      onFocus={() => c && setFoco(c)}
                      onClick={() => c && setFoco(c)}
                      aria-label={`${curto} ${h}h: ${k == null ? 'sem dado' : fmt(valor(c)!)}`}
                      className={clsx(
                        'h-6 rounded-[4px] transition-transform hover:scale-125 hover:z-10',
                        k == null && (c && c.investimento > 0 ? 'bg-slate-200/70' : 'bg-slate-100'),
                        foco === c && c && 'ring-2 ring-slate-900/70'
                      )}
                      style={k != null ? { background: tom(k) } : undefined}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
        <span>{metrica === 'custo' ? 'mais caro' : 'menos'}</span>
        {[0.15, 0.35, 0.55, 0.75, 1].map(k => <span key={k} className="h-3 w-5 rounded" style={{ background: tom(k) }} />)}
        <span>{metrica === 'custo' ? 'mais barato' : 'mais'}</span>
      </div>
    </div>
  )
}

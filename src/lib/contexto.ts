import type { SupabaseClient } from '@supabase/supabase-js'
import { dadosTrafego, metaConfigurado } from './meta'
import { snapshotInstagram, type SnapshotInstagram } from './instagram'
import { PLANO_STATUS_LABEL, OBJETIVO_LABEL, SITUACAO_LABEL, brl, num, pct, type DadosTrafego, type PlanoItem } from './trafego'

// Transforma os dados ao vivo (Meta Ads e Instagram) em texto curto para
// entrar no prompt das IAs. Só servidor.

const d2 = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function trafegoComoTexto(d: DadosTrafego, plano: PlanoItem[] = []) {
  const linhas: string[] = [`Conta de anúncios: ${d.conta.nome}. Período: últimos 30 dias.`]
  const m = d.resumo
  if (m) {
    const roas = m.investimento > 0 && m.receita > 0 ? ` · ROAS ${(m.receita / m.investimento).toFixed(2)}` : ''
    linhas.push(
      `Totais: investimento ${brl(m.investimento)} · alcance ${num(m.alcance)} · CTR ${pct(m.ctr)} · CPM ${brl(m.cpm)} · ` +
        `${num(m.cliquesLink)} cliques no link · ${num(m.visitas)} visitas ao site · ${num(m.carrinho)} carrinhos · ` +
        `${num(m.checkout)} checkouts · ${num(m.compras)} compras (${brl(m.receita)})${roas} · ${num(m.conversas)} conversas no direct.`
    )
  } else linhas.push('Sem investimento no período.')

  if (d.campanhas.length) {
    linhas.push('Campanhas:')
    for (const c of d.campanhas.slice(0, 12)) {
      const cm = c.metricas
      linhas.push(
        `- ${c.nome} [${SITUACAO_LABEL[c.situacao]}, ${OBJETIVO_LABEL[c.objetivo] ?? c.objetivo}` +
          `${c.orcamentoDiario ? `, ${brl(c.orcamentoDiario, 0)}/dia` : ''}]` +
          (cm ? `: ${brl(cm.investimento)}, CTR ${pct(cm.ctr)}, ${num(cm.visitas)} visitas, ${num(cm.carrinho)} carrinhos, ${num(cm.compras)} compras` : ': sem entrega no período')
      )
    }
  }

  const serie = d.serie.filter(s => s.investimento > 0)
  if (serie.length >= 7) {
    const meio = Math.floor(serie.length / 2)
    const soma = (xs: typeof serie) => xs.reduce((a, s) => a + s.investimento, 0)
    linhas.push(`Ritmo: ${brl(soma(serie.slice(0, meio)))} na 1ª metade do período e ${brl(soma(serie.slice(meio)))} na 2ª.`)
  }

  if (plano.length) {
    linhas.push('Plano de ação de tráfego já registrado:')
    for (const p of plano) linhas.push(`- [${PLANO_STATUS_LABEL[p.status]}] ${p.titulo}${p.prazo ? ` (até ${p.prazo})` : ''}`)
  }
  return linhas.join('\n')
}

export function instagramComoTexto(s: SnapshotInstagram) {
  const p = s.perfil
  const linhas = [
    `Perfil @${p.username}: ${num(p.seguidores)} seguidores, ${num(p.totalPosts)} posts no total, ${s.postsUltimos30d} posts nos últimos 30 dias.`,
  ]
  if (p.bio) linhas.push(`Bio: ${p.bio.replace(/\n/g, ' ')}`)
  const c = s.conta28d
  if (c.alcance != null) {
    linhas.push(`Conta nos últimos 28 dias: alcance ${num(c.alcance)}, ${num(c.contasEngajadas ?? 0)} contas engajadas, ${num(c.interacoes ?? 0)} interações, ${num(c.visitasPerfil ?? 0)} visitas ao perfil.`)
  }
  if (s.alcanceMedio != null) linhas.push(`Alcance médio por post: ${num(s.alcanceMedio)}. Engajamento médio sobre alcance: ${pct(s.taxaEngajamento ?? 0)}.`)
  if (s.porFormato.length) {
    linhas.push(
      'Desempenho por formato (últimos posts): ' +
        s.porFormato.map(f => `${f.formato} ${f.posts} posts, ${num(f.interacoesMedias)} interações/post${f.alcanceMedio != null ? `, alcance ${num(f.alcanceMedio)}` : ''}`).join('; ') +
        '.'
    )
  }
  const post = (x: SnapshotInstagram['posts'][number]) =>
    `- ${d2(x.data)} ${x.formato}: ${num(x.interacoes)} interações${x.alcance != null ? `, alcance ${num(x.alcance)}` : ''}${x.salvamentos ? `, ${x.salvamentos} salvamentos` : ''} — "${x.legenda.slice(0, 120).replace(/\n/g, ' ')}"`
  if (s.melhores.length) linhas.push('Posts que mais engajaram:', ...s.melhores.map(post))
  if (s.piores.length) linhas.push('Posts que menos engajaram:', ...s.piores.map(post))
  if (s.avisos.length) linhas.push(`Limitações dos dados: ${s.avisos.join(' ')}`)
  return linhas.join('\n')
}

export interface ContextoAoVivo {
  trafego: string | null
  instagram: string | null
  plano: PlanoItem[]
  contaTrafegoId: string | null
  avisos: string[]
}

/** Busca Meta Ads e Instagram do cliente em paralelo. Falhas viram avisos, nunca erro. */
export async function contextoAoVivo(db: SupabaseClient, clienteId: string): Promise<ContextoAoVivo> {
  const avisos: string[] = []
  if (!metaConfigurado()) {
    return { trafego: null, instagram: null, plano: [], contaTrafegoId: null, avisos: ['META_ACCESS_TOKEN não configurado.'] }
  }

  const [conta, cliente] = await Promise.all([
    db.from('trafego_contas').select('id, meta_ad_account_id, plano').eq('cliente_fixo_id', clienteId).maybeSingle(),
    db.from('clientes_fixos').select('instagram_user_id').eq('id', clienteId).maybeSingle(),
  ])

  const plano = ((conta.data?.plano ?? []) as PlanoItem[])
  const igId = (cliente.data as { instagram_user_id?: string | null } | null)?.instagram_user_id

  const [trafego, instagram] = await Promise.all([
    conta.data
      ? dadosTrafego(conta.data.meta_ad_account_id, 'last_30d')
          .then(d => trafegoComoTexto(d, plano))
          .catch(e => { avisos.push(`Meta Ads: ${e instanceof Error ? e.message : 'falha'}`); return null })
      : Promise.resolve(null),
    igId
      ? snapshotInstagram(igId)
          .then(instagramComoTexto)
          .catch(e => { avisos.push(`Instagram: ${e instanceof Error ? e.message : 'falha'}`); return null })
      : Promise.resolve(null),
  ])

  if (!conta.data) avisos.push('Cliente sem conta de anúncios vinculada.')
  if (!igId) avisos.push('Cliente sem Instagram vinculado.')

  return { trafego, instagram, plano, contaTrafegoId: conta.data?.id ?? null, avisos }
}

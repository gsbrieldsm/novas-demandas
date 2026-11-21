import type { SupabaseClient } from '@supabase/supabase-js'
import { esc } from './telegram'

// Assistente pessoal: junta demandas, agenda e contas do ERP num resumo curto
// para o Telegram. Pensado para TDAH: poucas linhas, uma prioridade clara.

const FUSO = 'America/Sao_Paulo'
const URL_ERP = 'https://www.gmeco.com.br/admin'

/** AAAA-MM-DD no horário de Brasília, com deslocamento de dias. */
export function diaBR(deslocamento = 0, base = new Date()) {
  const d = new Date(base.getTime() + deslocamento * 86400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const horaBR = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

interface Demanda { id: string; title: string; company: string | null; deadline: string | null; scheduled_at: string | null; status: string; priority: string }
interface Evento { titulo: string; start_at: string; all_day: boolean }
interface Despesa { descricao: string; valor: number; vencimento: string | null; tipo: string }

/** Data (AAAA-MM-DD) em que a demanda vence, no horário de Brasília. */
function diaDaDemanda(t: Demanda) {
  if (t.deadline) return t.deadline.slice(0, 10)
  if (t.scheduled_at) return diaBR(0, new Date(t.scheduled_at))
  return null
}

async function carregar(db: SupabaseClient, hoje: string, ate: string) {
  const inicio = new Date(`${hoje}T00:00:00-03:00`).toISOString()
  const fim = new Date(`${ate}T23:59:59-03:00`).toISOString()
  const [tickets, eventos, despesas] = await Promise.all([
    db.from('tickets').select('id,title,company,deadline,scheduled_at,status,priority').not('status', 'in', '(concluido,cancelado)'),
    db.from('eventos').select('titulo,start_at,all_day').gte('start_at', inicio).lte('start_at', fim).order('start_at'),
    db.from('despesas').select('descricao,valor,vencimento,tipo').eq('pago', false).not('vencimento', 'is', null).lte('vencimento', ate).order('vencimento'),
  ])
  return {
    demandas: (tickets.data ?? []) as Demanda[],
    eventos: (eventos.data ?? []) as Evento[],
    contas: (despesas.data ?? []) as Despesa[],
  }
}

const peso = (t: Demanda) => (t.priority === 'urgente' ? 0 : t.priority === 'alta' ? 1 : 2)

function linhaDemanda(t: Demanda, hoje: string) {
  const dia = diaDaDemanda(t)
  const quando = !dia ? '' : dia < hoje ? ` <i>(atrasada desde ${ddmm(dia)})</i>` : dia === hoje ? '' : ` <i>(${ddmm(dia)})</i>`
  const hora = t.scheduled_at && dia === hoje ? `${horaBR(t.scheduled_at)} · ` : ''
  const urg = t.priority === 'urgente' ? '🔴 ' : t.priority === 'alta' ? '🟠 ' : ''
  return `• ${urg}${hora}${esc(t.title)}${t.company ? ` — ${esc(t.company)}` : ''}${quando}`
}

/** Resumo da manhã: foco, agenda, entregas, contas. */
export async function briefingManha(db: SupabaseClient, agora = new Date()) {
  const hoje = diaBR(0, agora), d3 = diaBR(3, agora)
  const { demandas, eventos, contas } = await carregar(db, hoje, d3)

  const comData = demandas.filter(t => diaDaDemanda(t)).sort((a, b) => diaDaDemanda(a)!.localeCompare(diaDaDemanda(b)!) || peso(a) - peso(b))
  const atrasadas = comData.filter(t => diaDaDemanda(t)! < hoje)
  const deHoje = comData.filter(t => diaDaDemanda(t) === hoje)
  const proximas = comData.filter(t => diaDaDemanda(t)! > hoje && diaDaDemanda(t)! <= d3)
  const semData = demandas.filter(t => !diaDaDemanda(t)).length
  const eventosHoje = eventos.filter(e => diaBR(0, new Date(e.start_at)) === hoje)
  const contasAtrasadas = contas.filter(c => c.vencimento! < hoje)
  const contasProximas = contas.filter(c => c.vencimento! >= hoje)

  // Atrasada mais recente primeiro: a de meses atrás provavelmente já perdeu a vez.
  const foco = deHoje.sort((a, b) => peso(a) - peso(b))[0] ?? atrasadas[atrasadas.length - 1] ?? proximas[0]
  const dow = SEMANA[new Date(`${hoje}T12:00:00-03:00`).getUTCDay()]
  const l: string[] = [`☀️ <b>Bom dia, Gabriel!</b> ${dow}, ${ddmm(hoje)}`]

  l.push('', foco ? `🎯 <b>Foco número 1:</b> ${esc(foco.title)}` : '🎯 <b>Nenhuma entrega com prazo hoje.</b> Bom dia para adiantar o que está sem data.')

  if (eventosHoje.length) {
    l.push('', '📅 <b>Agenda</b>')
    for (const e of eventosHoje) l.push(`• ${e.all_day ? 'dia todo' : horaBR(e.start_at)} · ${esc(e.titulo)}`)
  }
  if (deHoje.length) {
    l.push('', `✅ <b>Entregar hoje</b> (${deHoje.length})`)
    deHoje.slice(0, 6).forEach(t => l.push(linhaDemanda(t, hoje)))
  }
  if (atrasadas.length) {
    l.push('', `⏰ <b>Atrasadas</b> (${atrasadas.length})`)
    atrasadas.slice(0, 5).forEach(t => l.push(linhaDemanda(t, hoje)))
    if (atrasadas.length > 5) l.push(`• e mais ${atrasadas.length - 5}…`)
  }
  if (proximas.length) {
    l.push('', '🗓 <b>Próximos 3 dias</b>')
    proximas.slice(0, 5).forEach(t => l.push(linhaDemanda(t, hoje)))
  }
  if (contasAtrasadas.length || contasProximas.length) {
    l.push('', '💸 <b>Contas</b>')
    for (const c of contasAtrasadas) l.push(`• ⚠️ ${esc(c.descricao)} ${brl(+c.valor)} <i>(venceu ${ddmm(c.vencimento!)})</i>`)
    for (const c of contasProximas) l.push(`• ${esc(c.descricao)} ${brl(+c.valor)} — ${c.vencimento === hoje ? '<b>vence hoje</b>' : `vence ${ddmm(c.vencimento!)}`}`)
  }
  if (semData) l.push('', `📥 ${semData} demanda${semData > 1 ? 's' : ''} sem prazo esperando data.`)
  l.push('', `<a href="${URL_ERP}/demandas">Abrir demandas</a> · /hoje · /amanha · /contas`)
  return l.join('\n')
}

/** Fechamento do dia: o que ficou pendente e o que vem amanhã. */
export async function fechamentoDia(db: SupabaseClient, agora = new Date()) {
  const hoje = diaBR(0, agora), amanha = diaBR(1, agora)
  const { demandas, eventos, contas } = await carregar(db, amanha, amanha)
  const pendentesHoje = demandas.filter(t => { const d = diaDaDemanda(t); return d && d <= hoje }).sort((a, b) => diaDaDemanda(b)!.localeCompare(diaDaDemanda(a)!))
  const deAmanha = demandas.filter(t => diaDaDemanda(t) === amanha).sort((a, b) => peso(a) - peso(b))
  const contasAmanha = contas.filter(c => c.vencimento === amanha)

  const l = ['🌙 <b>Fechamento do dia</b>']
  l.push('', pendentesHoje.length ? `Ficaram <b>${pendentesHoje.length}</b> pendentes até hoje:` : '🎉 Nada atrasado. Dia fechado!')
  pendentesHoje.slice(0, 5).forEach(t => l.push(linhaDemanda(t, hoje)))
  if (eventos.length || deAmanha.length || contasAmanha.length) {
    l.push('', '➡️ <b>Amanhã</b>')
    for (const e of eventos) l.push(`• ${e.all_day ? 'dia todo' : horaBR(e.start_at)} · ${esc(e.titulo)}`)
    deAmanha.slice(0, 5).forEach(t => l.push(linhaDemanda(t, amanha)))
    for (const c of contasAmanha) l.push(`• 💸 ${esc(c.descricao)} ${brl(+c.valor)} vence amanhã`)
  }
  l.push('', 'Desliga e descansa. Amanhã às 7h30 eu te mando o plano. 💙')
  return l.join('\n')
}

/** Só as contas a pagar do mês, para o comando /contas. */
export async function contasDoMes(db: SupabaseClient, agora = new Date()) {
  const hoje = diaBR(0, agora)
  const mes = Number(hoje.slice(5, 7)), ano = Number(hoje.slice(0, 4))
  const { data } = await db.from('despesas').select('descricao,valor,vencimento,pago').eq('mes', mes).eq('ano', ano)
  const lista = (data ?? []) as (Despesa & { pago: boolean })[]
  const abertas = lista.filter(d => !d.pago).sort((a, b) => (a.vencimento ?? '9').localeCompare(b.vencimento ?? '9'))
  const total = abertas.reduce((s, d) => s + +d.valor, 0)
  const pago = lista.filter(d => d.pago).reduce((s, d) => s + +d.valor, 0)
  const l = [`💸 <b>Contas de ${MESES[mes - 1]}</b>`, `Pago: ${brl(pago)} · A pagar: <b>${brl(total)}</b>`, '']
  for (const d of abertas) l.push(`• ${esc(d.descricao)} ${brl(+d.valor)}${d.vencimento ? ` — ${d.vencimento < hoje ? '⚠️ venceu' : 'vence'} ${ddmm(d.vencimento)}` : ''}`)
  if (!abertas.length) l.push('Tudo pago este mês. 🎉')
  return l.join('\n')
}

import type { SupabaseClient } from '@supabase/supabase-js'

interface PropostaParaVinculo {
  id: string
  modalidade: 'mensal' | 'pontual'
  valor: number | null
  cliente_nome: string
  cliente_email: string | null
  escopo: string | null
  cliente_fixo_id: string | null
  lead_id?: string | null
}

/**
 * Ao aceitar uma proposta mensal, garante que existe um cliente fixo vinculado:
 * cria um novo (com data de pagamento "a definir") ou ativa/atualiza o valor do existente.
 * Projetos pontuais não geram cliente fixo (não são recorrentes).
 * Se a proposta veio de um lead do CRM, marca o lead como fechado.
 */
export async function vincularClienteFixo(db: SupabaseClient, proposta: PropostaParaVinculo) {
  if (proposta.modalidade === 'mensal') {
    if (proposta.cliente_fixo_id) {
      await db
        .from('clientes_fixos')
        .update({ ativo: true, valor_mensal: proposta.valor ?? 0 })
        .eq('id', proposta.cliente_fixo_id)
    } else {
      const { data: cf } = await db
        .from('clientes_fixos')
        .insert({
          nome: proposta.cliente_nome,
          email: proposta.cliente_email,
          valor_mensal: proposta.valor ?? 0,
          dia_vencimento: null,
          ativo: true,
          tipo: 'cliente',
          data_inicio: new Date().toISOString().slice(0, 10),
          escopo_mensal: proposta.escopo,
        })
        .select()
        .single()
      if (cf) {
        await db.from('propostas').update({ cliente_fixo_id: cf.id }).eq('id', proposta.id)
      }
    }
  }

  if (proposta.lead_id) {
    await db
      .from('leads')
      .update({ status: 'fechado', convertido_em: new Date().toISOString() })
      .eq('id', proposta.lead_id)
  }
}

import { z } from 'zod'

// Reunião entre o agente de tráfego pago e o agente de social media.
// Tipos compartilhados entre a API (/api/agentes) e a tela /admin/agentes.

export type AgenteId = 'trafego' | 'social'

export const AGENTES: Record<AgenteId, { nome: string; papel: string }> = {
  trafego: { nome: 'Agente de Tráfego', papel: 'Meta Ads' },
  social: { nome: 'Agente de Social', papel: 'Instagram e conteúdo' },
}

export interface MensagemAgente {
  agente: AgenteId
  texto: string
}

export const AtaSchema = z.object({
  cenario: z.string().describe('Cenário atual do cliente em 3 a 4 frases, cruzando anúncios e Instagram, com os números que importam'),
  falta: z.array(z.string()).describe('O que falta hoje (dados, criativos, estrutura, conteúdo) — itens curtos'),
  precisa: z.array(z.string()).describe('O que um agente precisa do outro para o resultado melhorar — itens curtos dizendo quem entrega'),
  melhorar: z.array(z.string()).describe('O que vamos melhorar, em ordem de impacto — itens curtos'),
  acoes_trafego: z
    .array(
      z.object({
        titulo: z.string().describe('Ação no imperativo, ex: "Destravar a campanha da Black Friday"'),
        descricao: z.string().describe('O que fazer, em 1 a 2 frases'),
        prazo_dias: z.number().int().describe('Em quantos dias a partir de hoje deve estar feito'),
      })
    )
    .describe('Ações de tráfego pago acordadas na reunião, de 2 a 5'),
  pautas_social: z
    .array(
      z.object({
        tema: z.string().describe('Tema do conteúdo em uma frase'),
        formato: z.string().describe('Reels, Carrossel, Stories ou Post estático'),
        por_que: z.string().describe('Dado ou necessidade da reunião que justifica este conteúdo'),
      })
    )
    .describe('Conteúdos que o social media vai produzir, de 3 a 6'),
  briefing_social: z
    .string()
    .describe('Direcionamento pronto para colar no Estúdio de conteúdo ao gerar a próxima pauta, em 3 a 5 frases'),
})

export type Ata = z.infer<typeof AtaSchema>

export interface Reuniao {
  id: string
  created_at: string
  cliente_fixo_id: string
  foco: string | null
  mensagens: MensagemAgente[]
  resumo: Ata | null
  enviados: { plano_trafego?: boolean; estudio?: boolean }
}

/** Eventos enviados pela API em NDJSON enquanto a reunião acontece. */
export type EventoReuniao =
  | { tipo: 'contexto'; trafego: boolean; instagram: boolean; avisos: string[] }
  | { tipo: 'turno'; agente: AgenteId }
  | { tipo: 'texto'; agente: AgenteId; delta: string }
  | { tipo: 'fim_turno'; agente: AgenteId }
  | { tipo: 'ata_inicio' }
  | { tipo: 'ata'; ata: Ata }
  | { tipo: 'salvo'; reuniao: Reuniao | null; aviso?: string }
  | { tipo: 'erro'; mensagem: string }

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase'

export const maxDuration = 120

const anthropic = new Anthropic()

const LeituraSchema = z.object({
  contas: z.array(
    z.object({
      descricao: z.string().describe('Nome curto da conta, como aparece na imagem (ex: "Aluguel", "Cartão Riachuelo")'),
      valor: z.number().describe('Valor em reais, como número (ex: 1270.63). Se houver valor total e valor pago diferentes, use o valor total'),
      valor_pago: z.number().describe('Quanto já foi pago dessa conta; 0 se nada indica pagamento, igual ao valor se está quitada'),
      vencimento: z.string().describe('Data de vencimento AAAA-MM-DD se aparecer na imagem; string vazia se não aparecer'),
      tipo: z.enum(['pessoal', 'corporativa']).describe('corporativa para ferramentas, impostos da empresa, fornecedores e serviços do negócio; pessoal para o resto'),
    })
  ),
  observacao: z.string().describe('Algo que a pessoa precisa conferir (linhas ilegíveis, valores em branco, ambiguidade); vazio se tudo claro'),
})

const MIDIAS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export async function POST(req: Request) {
  const auth = await requireAuth(req, { modulo: 'financeiro' })
  if ('error' in auth) return auth.error

  const { imagem, mes, ano }: { imagem?: string; mes?: number; ano?: number } = await req.json()
  const m = imagem?.match(/^data:(image\/[a-z]+);base64,(.+)$/)
  const midia = m?.[1] as (typeof MIDIAS)[number] | undefined
  if (!m || !midia || !MIDIAS.includes(midia)) {
    return NextResponse.json({ error: 'Envie uma imagem (print, foto ou PNG/JPG).' }, { status: 400 })
  }

  try {
    const response = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system:
        'Você lê prints e fotos de contas a pagar (planilhas, boletos, faturas, extratos, listas) de uma pessoa no Brasil e transforma em lançamentos de despesa. Extraia só o que está na imagem, sem inventar valores. Ignore linhas sem valor e linhas de total/subtotal. Em planilhas, células destacadas (verde, riscado, "pago", ✓) ou uma coluna de valor pago indicam pagamento.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: midia, data: m[2] } },
            {
              type: 'text',
              text: `Liste as contas desta imagem. Os lançamentos vão para ${String(mes ?? '').padStart(2, '0')}/${ano ?? ''}; use esse mês e ano ao completar datas que apareçam só com o dia.`,
            },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(LeituraSchema) },
    })

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return NextResponse.json({ error: 'Não consegui ler essa imagem. Tente um print mais nítido.' }, { status: 422 })
    }
    return NextResponse.json(response.parsed_output)
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Limite de uso do Claude atingido. Tente de novo em instantes.' }, { status: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      console.error('despesas/ler:', error.status, error.message)
      return NextResponse.json({ error: `Falha ao ler a imagem (${error.status ?? 'rede'}).` }, { status: 502 })
    }
    throw error
  }
}

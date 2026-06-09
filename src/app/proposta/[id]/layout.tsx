import type { Metadata } from 'next'
import { getServiceClient } from '@/lib/supabase'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  try {
    const db = getServiceClient()
    const { data } = await db
      .from('propostas')
      .select('titulo, cliente_nome, cliente_empresa, modalidade, valor')
      .eq('id', id)
      .single()

    if (!data) {
      return {
        title: 'Proposta',
        description: 'Proposta de Gabriel Moraes & Co',
      }
    }

    const valorBR = data.valor
      ? Number(data.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

    const subtitulo = [
      data.cliente_empresa || data.cliente_nome,
      data.modalidade === 'mensal' ? 'Investimento recorrente mensal' : 'Projeto pontual',
      valorBR ? `${valorBR}${data.modalidade === 'mensal' ? '/mês' : ''}` : null,
    ].filter(Boolean).join(' · ')

    const titulo = `Proposta · ${data.titulo}`

    return {
      title: titulo,
      description: subtitulo || 'Marketing estratégico com propósito',
      openGraph: {
        title: titulo,
        description: subtitulo || 'Marketing estratégico com propósito',
        type: 'article',
        siteName: 'Gabriel Moraes & Co',
        locale: 'pt_BR',
      },
      twitter: {
        card: 'summary_large_image',
        title: titulo,
        description: subtitulo || 'Marketing estratégico com propósito',
      },
      robots: { index: false, follow: false }, // proposta é privada — não indexa no Google
    }
  } catch {
    return {
      title: 'Proposta · Gabriel Moraes & Co',
      description: 'Marketing estratégico com propósito',
    }
  }
}

export default function PropostaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

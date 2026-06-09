import { Resend } from 'resend'
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS } from '@/types'
import type { Ticket } from '@/types'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = process.env.RESEND_FROM ?? 'GM&Co <onboarding@resend.dev>'
const TO = process.env.NOTIFY_EMAIL ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://novas-demandas.vercel.app'

export async function sendNewTicketEmail(ticket: Partial<Ticket> & { id: string }) {
  if (!resend || !TO) {
    console.warn('[email] Resend não configurado — pulando envio')
    return
  }

  const tipo = ticket.request_type ? REQUEST_TYPE_LABELS[ticket.request_type] : '—'
  const prioridade = ticket.priority ? PRIORITY_LABELS[ticket.priority] : '—'
  const link = `${APP_URL}/admin/chamado/${ticket.id}`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1a18;">
      <div style="background:linear-gradient(135deg,#C5A880,#6B4C28);color:#fff;padding:24px;border-radius:16px 16px 0 0;">
        <p style="margin:0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8;">GM&amp;Co · Nova demanda</p>
        <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:700;">${escape(ticket.title ?? 'Sem título')}</h1>
      </div>

      <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:120px;">Cliente</td><td style="padding:8px 0;font-weight:600;">${escape(ticket.client_name ?? '—')}</td></tr>
          ${ticket.company ? `<tr><td style="padding:8px 0;color:#888;">Empresa</td><td style="padding:8px 0;">${escape(ticket.company)}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#888;">Tipo</td><td style="padding:8px 0;">${tipo}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Prioridade</td><td style="padding:8px 0;">${prioridade}</td></tr>
          ${ticket.deadline ? `<tr><td style="padding:8px 0;color:#888;">Prazo</td><td style="padding:8px 0;">${escape(ticket.deadline)}</td></tr>` : ''}
        </table>

        ${ticket.description ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 8px 0;color:#888;font-size:13px;">Descrição</p>
            <p style="margin:0;line-height:1.5;">${escape(ticket.description)}</p>
          </div>
        ` : ''}

        ${ticket.purpose ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 8px 0;color:#888;font-size:13px;">Objetivo</p>
            <p style="margin:0;line-height:1.5;font-style:italic;">"${escape(ticket.purpose)}"</p>
          </div>
        ` : ''}

        <a href="${link}" style="display:inline-block;margin-top:24px;background:#100E0B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
          Abrir chamado →
        </a>
      </div>

      <p style="margin-top:16px;font-size:12px;color:#aaa;text-align:center;">Notificação automática · GM&amp;Co</p>
    </div>
  `

  try {
    await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `🔔 Nova demanda: ${ticket.title ?? 'Sem título'}`,
      html,
    })
  } catch (e) {
    console.error('[email] Erro ao enviar:', e)
  }
}

// ============ CLIENT-FACING EMAILS ============

interface ClientEmailContext {
  ticketId: string
  clientName: string
  clientEmail: string
  ticketTitle: string
}

/**
 * Template base — header dark gold + corpo branco + rodapé.
 * Mantém identidade visual da marca.
 */
function buildEmailHtml({
  badge,
  emoji,
  headline,
  message,
  link,
  cta,
  whatsappNumber,
}: {
  badge: string
  emoji: string
  headline: string
  message: string
  link?: string
  cta?: string
  whatsappNumber?: string
}) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;max-width:580px;margin:0 auto;background:#f5f6f8;padding:0;">
      <div style="padding:32px 16px;">
        <div style="background:#0d1117;color:#fff;padding:32px 32px 28px 32px;border-radius:16px 16px 0 0;text-align:center;position:relative;overflow:hidden;">
          <div style="position:relative;z-index:2;">
            <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a96e;font-weight:700;">
              Gabriel Moraes &amp; Co
            </p>
            <p style="margin:0;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
              Marketing &amp; Estratégia
            </p>
            <div style="display:inline-block;margin-top:24px;padding:6px 14px;background:rgba(201,169,110,0.15);border:1px solid rgba(201,169,110,0.4);border-radius:999px;">
              <p style="margin:0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#e8c987;font-weight:700;">
                ${escape(badge)}
              </p>
            </div>
            <p style="margin:18px 0 0 0;font-size:36px;line-height:1;">${emoji}</p>
            <h1 style="margin:14px 0 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#fff;">
              ${escape(headline)}
            </h1>
          </div>
        </div>

        <div style="background:#fff;padding:32px;border-radius:0 0 16px 16px;border-left:1px solid #eef0f3;border-right:1px solid #eef0f3;border-bottom:1px solid #eef0f3;">
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#3a4452;">
            ${message}
          </p>

          ${link && cta ? `
            <div style="text-align:center;margin:28px 0 8px 0;">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#c9a96e,#8B6840);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:0.02em;box-shadow:0 8px 20px rgba(201,169,110,0.3);">
                ${escape(cta)}
              </a>
            </div>
          ` : ''}

          ${whatsappNumber ? `
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid #eef0f3;text-align:center;">
              <p style="margin:0 0 10px 0;font-size:13px;color:#5a6e84;">Precisa falar com a gente?</p>
              <a href="https://wa.me/${whatsappNumber}" style="display:inline-block;color:#25D366;text-decoration:none;font-size:13px;font-weight:600;">
                💬 WhatsApp direto
              </a>
            </div>
          ` : ''}
        </div>

        <div style="text-align:center;padding:20px 16px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8b9eb5;font-weight:600;">
            gmeco.com.br
          </p>
          <p style="margin:6px 0 0 0;font-size:10px;color:#aab4c2;">
            Marketing estratégico com propósito.
          </p>
        </div>
      </div>
    </div>
  `
}

const WHATSAPP_NUMBER = '5547988194822' // (47) 98819-4822

/**
 * Confirmação de recebimento — assim que o cliente cria a demanda
 */
export async function sendClientTicketCreated(ctx: ClientEmailContext) {
  if (!resend || !ctx.clientEmail) return
  const link = `${APP_URL}/acompanhar/${ctx.ticketId}`
  const firstName = ctx.clientName.split(' ')[0] || 'olá'

  const html = buildEmailHtml({
    badge: 'Demanda recebida',
    emoji: '✓',
    headline: 'Recebemos seu pedido',
    message: `Oi ${escape(firstName)}, recebemos sua solicitação <strong>"${escape(ctx.ticketTitle)}"</strong>.<br><br>Em breve vamos analisar e dar andamento. Você pode acompanhar a evolução em tempo real pelo link abaixo.`,
    link,
    cta: 'Acompanhar minha demanda',
    whatsappNumber: WHATSAPP_NUMBER,
  })

  try {
    await resend.emails.send({
      from: FROM,
      to: ctx.clientEmail,
      subject: `✓ Recebemos seu pedido · ${ctx.ticketTitle}`,
      html,
    })
  } catch (e) {
    console.error('[email-client] Erro ao enviar criação:', e)
  }
}

/**
 * Atualização de status — quando muda
 */
export async function sendClientStatusChanged(
  ctx: ClientEmailContext,
  novoStatus: 'em_andamento' | 'em_revisao' | 'concluido' | 'cancelado'
) {
  if (!resend || !ctx.clientEmail) return
  const link = `${APP_URL}/acompanhar/${ctx.ticketId}`
  const firstName = ctx.clientName.split(' ')[0] || 'olá'

  let badge = ''
  let emoji = ''
  let headline = ''
  let message = ''
  let subject = ''
  let cta = 'Ver detalhes'

  switch (novoStatus) {
    case 'em_andamento':
      badge = 'Atualização'
      emoji = '⚡'
      headline = 'Começamos a trabalhar'
      message = `Oi ${escape(firstName)}, sua demanda <strong>"${escape(ctx.ticketTitle)}"</strong> entrou em produção. Logo logo voltamos com novidades.`
      subject = `⚡ Em andamento · ${ctx.ticketTitle}`
      break
    case 'em_revisao':
      badge = 'Fase final'
      emoji = '🔍'
      headline = 'Em revisão final'
      message = `Oi ${escape(firstName)}, sua demanda <strong>"${escape(ctx.ticketTitle)}"</strong> está nos retoques finais. Logo logo enviamos pra sua aprovação.`
      subject = `🔍 Em revisão · ${ctx.ticketTitle}`
      cta = 'Acompanhar evolução'
      break
    case 'concluido':
      badge = 'Concluído'
      emoji = '🎯'
      headline = 'Entrega pronta!'
      message = `Oi ${escape(firstName)}, terminamos a entrega de <strong>"${escape(ctx.ticketTitle)}"</strong>!<br><br>Confere o resultado no link abaixo e me chama no WhatsApp pra alinhar qualquer ajuste.`
      subject = `🎯 Pronto! · ${ctx.ticketTitle}`
      cta = 'Ver entrega'
      break
    case 'cancelado':
      badge = 'Cancelada'
      emoji = '×'
      headline = 'Demanda cancelada'
      message = `Oi ${escape(firstName)}, conforme combinado, a demanda <strong>"${escape(ctx.ticketTitle)}"</strong> foi cancelada.<br><br>Qualquer coisa, é só me chamar.`
      subject = `Cancelada · ${ctx.ticketTitle}`
      cta = 'Ver detalhes'
      break
  }

  const html = buildEmailHtml({
    badge, emoji, headline, message, link, cta,
    whatsappNumber: WHATSAPP_NUMBER,
  })

  try {
    await resend.emails.send({
      from: FROM,
      to: ctx.clientEmail,
      subject,
      html,
    })
  } catch (e) {
    console.error('[email-client] Erro ao enviar status:', e)
  }
}

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

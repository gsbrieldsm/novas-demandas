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

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

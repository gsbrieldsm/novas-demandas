// Envio de mensagens pelo bot do Telegram. Só servidor.
// TELEGRAM_BOT_TOKEN: token do @BotFather. TELEGRAM_CHAT_ID: conversa do Gabriel com o bot.

const API = 'https://api.telegram.org'

export function telegramConfigurado() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

/** Escapa texto para o modo HTML do Telegram. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function enviarTelegram(texto: string, chatId = process.env.TELEGRAM_CHAT_ID) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) throw new Error('Telegram não configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).')
  const r = await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
    cache: 'no-store',
  })
  const j = (await r.json()) as { ok: boolean; description?: string }
  // Nunca devolve o token: a mensagem de erro do Telegram não o inclui.
  if (!j.ok) throw new Error(`Telegram: ${j.description ?? r.status}`)
}

/**
 * Formata uma quantidade de minutos como "1h 30min", "45min", "2h"
 */
export function formatMinutos(min: number): string {
  if (min < 0) min = 0
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/**
 * Recebe string "1h 30min", "1:30", "1.5", "90" → retorna minutos
 */
export function parseMinutos(s: string): number {
  const trim = s.trim().toLowerCase()
  if (!trim) return 0

  // "1h 30min" ou "1h" ou "30min"
  const hAndMin = trim.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?$/)
  if (hAndMin && (hAndMin[1] || hAndMin[2])) {
    const h = parseInt(hAndMin[1] ?? '0', 10)
    const m = parseInt(hAndMin[2] ?? '0', 10)
    return h * 60 + m
  }

  // "1:30"
  const colon = trim.match(/^(\d+):(\d+)$/)
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10)

  // "1.5" → 90
  if (/^\d+(\.\d+)?$/.test(trim)) {
    const f = parseFloat(trim)
    // Se for inteiro, trata como minutos. Se decimal, como horas.
    return Number.isInteger(f) && f <= 480 ? f : Math.round(f * 60)
  }

  return 0
}

/**
 * Calcula minutos a partir de timer iniciado em `started_at` até agora.
 */
export function minutosDesde(startedAt: string): number {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - start) / 60000))
}

/**
 * Calcula R$/h dado receita e minutos
 */
export function valorHora(receita: number, minutos: number): number | null {
  if (minutos <= 0) return null
  return (receita / minutos) * 60
}

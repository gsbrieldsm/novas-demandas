import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(senha, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salt, hash] = hashArmazenado.split(':')
  if (!salt || !hash) return false
  const hashTentativa = scryptSync(senha, salt, 64)
  const hashOriginal = Buffer.from(hash, 'hex')
  if (hashTentativa.length !== hashOriginal.length) return false
  return timingSafeEqual(hashTentativa, hashOriginal)
}

export function criarSessionToken(clienteFixoId: string): string {
  const exp = Date.now() + SESSION_MAX_AGE_MS
  const payload = `${clienteFixoId}.${exp}`
  const assinatura = createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}.${assinatura}`).toString('base64url')
}

export function verificarSessionToken(token: string): { clienteFixoId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const [clienteFixoId, expStr, assinatura] = decoded.split('.')
    if (!clienteFixoId || !expStr || !assinatura) return null

    const payload = `${clienteFixoId}.${expStr}`
    const assinaturaEsperada = createHmac('sha256', SECRET).update(payload).digest('hex')
    if (assinatura.length !== assinaturaEsperada.length) return null
    if (!timingSafeEqual(Buffer.from(assinatura), Buffer.from(assinaturaEsperada))) return null

    if (Date.now() > Number(expStr)) return null
    return { clienteFixoId }
  } catch {
    return null
  }
}

export const PORTAL_COOKIE_NAME = 'portal_session'
export const PORTAL_COOKIE_MAX_AGE = SESSION_MAX_AGE_MS / 1000

/** Lê e valida o cookie de sessão do portal a partir de uma Request. */
export function getPortalSession(req: Request): { clienteFixoId: string } | null {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${PORTAL_COOKIE_NAME}=([^;]+)`))
  if (!match) return null
  return verificarSessionToken(decodeURIComponent(match[1]))
}

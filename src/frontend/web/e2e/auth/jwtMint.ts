import { createHmac } from 'node:crypto'

function b64urlJson(obj: unknown): string {
  const s = JSON.stringify(obj)
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * HS256 JWT compatible with API `Auth:Jwt` validation (iss, aud, sub, exp, optional groups as comma list).
 */
export function mintTestJwt(opts: {
  issuer: string
  audience: string
  subject: string
  signingKeyBase64: string
  groups?: string[]
  ttlSeconds?: number
}): string {
  const key = Buffer.from(opts.signingKeyBase64.trim(), 'base64')
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (opts.ttlSeconds ?? 7200)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload: Record<string, string | number> = {
    iss: opts.issuer,
    aud: opts.audience,
    sub: opts.subject,
    iat: now,
    exp,
  }
  if (opts.groups?.length) payload.groups = opts.groups.join(',')
  const payloadPart = b64urlJson(payload)
  const data = `${header}.${payloadPart}`
  const sig = createHmac('sha256', key).update(data).digest()
  const sigB64 = sig
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${data}.${sigB64}`
}

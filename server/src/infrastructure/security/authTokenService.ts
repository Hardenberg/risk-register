import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

interface TokenPayload {
  sub: string
  iat: number
}

const defaultMaxAgeMs = 8 * 60 * 60 * 1000

export class AuthTokenService {
  constructor (
    private readonly secret = process.env.AUTH_TOKEN_SECRET ?? randomBytes(32).toString('base64url'),
    private readonly maxAgeMs = defaultMaxAgeMs
  ) {}

  createToken (userId: string): string {
    const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now() })).toString('base64url')
    return `${payload}.${this.sign(payload)}`
  }

  verifyToken (token: string): string | null {
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra !== undefined) return null
    if (!safeCompare(signature, this.sign(payload))) return null

    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<TokenPayload>
      if (typeof parsed.sub !== 'string' || typeof parsed.iat !== 'number') return null
      if (parsed.sub.trim().length === 0) return null
      const age = Date.now() - parsed.iat
      if (age < 0 || age > this.maxAgeMs) return null
      return parsed.sub
    } catch {
      return null
    }
  }

  private sign (payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url')
  }
}

function safeCompare (actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const keyLength = 64

export function hashPassword (password: string): string {
  validatePassword(password)
  const salt = randomBytes(16).toString('base64')
  const hash = scryptSync(password, salt, keyLength).toString('base64')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword (password: string, storedHash: string): boolean {
  const [, salt, expectedHash] = storedHash.split('$')
  if (!salt || !expectedHash) return false

  const expected = Buffer.from(expectedHash, 'base64')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function validatePassword (password: string): void {
  if (password.length < 8) {
    throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.')
  }
}

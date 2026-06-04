import crypto from 'crypto'
import bcrypt from 'bcrypt'

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusable chars (0/O, 1/I)
const CODE_LENGTH = 8
const HASH_ROUNDS = 10

export function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH)
  return Array.from(bytes)
    .map(b => CHARSET[b % CHARSET.length])
    .join('')
}

export async function hashCode(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext.toUpperCase(), HASH_ROUNDS)
}

export async function verifyCode(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext.toUpperCase(), hash)
}

/** Strip spaces and dots, uppercase — normalises both "VB3X9KQM" and "VB3X · 9KQM" */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s·.]/g, '').toUpperCase()
}

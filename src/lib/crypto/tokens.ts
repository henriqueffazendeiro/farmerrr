import 'server-only'

import crypto from 'node:crypto'
import { serverEnv } from '@/lib/config/env'

/**
 * Cifra os tokens de OAuth antes de irem para a base de dados.
 * AES-256-GCM: o `tag` autentica, por isso um registo adulterado falha a
 * decifragem em vez de devolver lixo.
 *
 * Gerar a chave:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const IV_BYTES = 12

function key(): Buffer {
  const { TOKEN_ENCRYPTION_KEY } = serverEnv()
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY em falta — necessária para guardar tokens.')
  }
  const raw = Buffer.from(TOKEN_ENCRYPTION_KEY, 'base64')
  if (raw.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY tem de ser 32 bytes em base64.')
  }
  return raw
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(IV_BYTES, IV_BYTES + 16)
  const encrypted = raw.subarray(IV_BYTES + 16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function encryptOptional(plain: string | null): string | null {
  return plain ? encryptToken(plain) : null
}

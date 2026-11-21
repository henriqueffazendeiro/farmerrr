import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

/** Cookie com um identificador anónimo do browser: um voto por browser e por live. */
const VOTER_COOKIE = 'farmerrr_voter'

const hashVoter = (id: string) => createHash('sha256').update(`farmerrr-live-vote:${id}`).digest('hex')

/** Hash do votante atual, ou null se este browser ainda não votou (só leitura: serve em Server Components). */
export async function currentVoterHash() {
  const id = (await cookies()).get(VOTER_COOKIE)?.value
  return id && /^[0-9a-f-]{36}$/.test(id) ? hashVoter(id) : null
}

/** Hash do votante atual, criando o cookie se for a primeira vez (só em Server Actions / Route Handlers). */
export async function ensureVoterHash() {
  const jar = await cookies()
  let id = jar.get(VOTER_COOKIE)?.value
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID()
    jar.set(VOTER_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 400 * 86400 })
  }
  return hashVoter(id)
}

const monthIn = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).format(date)

/** A votação de uma live fica aberta desde o início da live até ao fim desse mês, no fuso da competição. */
export function ratingOpen(startedAt: string, timezone: string, now = new Date()) {
  const started = new Date(startedAt)
  return started.getTime() <= now.getTime() && monthIn(started, timezone) === monthIn(now, timezone)
}

import { cookies } from 'next/headers'

export async function hasSbAuthCookie() {
  const cookieStore = await cookies()
  return cookieStore.getAll().some(c => c.name.includes('-auth-token'))
}

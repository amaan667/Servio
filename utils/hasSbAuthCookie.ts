import { cookies } from 'next/headers'
export function hasSbAuthCookie() {
  return cookies().getAll().some(c => c.name.includes('-auth-token'))
}

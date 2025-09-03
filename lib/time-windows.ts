import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'
import { startOfDay, subMinutes } from 'date-fns'

export function timeWindows(venueTz: string) {
  const nowUtc = new Date()                    // your timestamps are UTC in DB
  const nowLocal = utcToZonedTime(nowUtc, venueTz)

  const startOfTodayLocal = startOfDay(nowLocal)
  const startOfTodayUtc = zonedTimeToUtc(startOfTodayLocal, venueTz)

  const thirtyMinAgoUtc = subMinutes(nowUtc, 30)

  return { nowUtc, startOfTodayUtc, thirtyMinAgoUtc }
}

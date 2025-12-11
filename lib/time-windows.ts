import { toZonedTime } from "date-fns-tz";
import { startOfDay, subMinutes } from "date-fns";

export function timeWindows(venueTz: string) {
  const nowUtc = new Date(); // your timestamps are UTC in DB
  const nowLocal = toZonedTime(nowUtc, venueTz);

  const startOfTodayLocal = startOfDay(nowLocal);
  const startOfTodayUtc = new Date(
    startOfTodayLocal.getTime() - startOfTodayLocal.getTimezoneOffset() * 60000
  );

  const thirtyMinAgoUtc = subMinutes(nowUtc, 30);

  return { nowUtc, startOfTodayUtc, thirtyMinAgoUtc };
}

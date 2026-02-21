import { DateTime } from "luxon";

export type AmPm = "AM" | "PM";

export function to24h(
  hour12: number,
  minute: number,
  ampm: AmPm
): { hour: number; minute: number } {
  let h = hour12 % 12;
  if (ampm === "PM") h += 12;
  return { hour: h, minute };
}

export function buildIsoFromLocal(dateYYYYMMDD: string, hour24: number, minute: number): string {
  // Build ISO string that represents the local time without timezone conversion
  // Create a date object and manually set the time to avoid timezone issues
  const date = new Date(dateYYYYMMDD);
  date.setHours(hour24, minute, 0, 0);

  return date.toISOString();
}

export function isOvernight(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): boolean {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end <= start; // same time or before means cross midnight
}

export function addDaysISO(dateYYYYMMDD: string, days: number): string {
  const d = new Date(dateYYYYMMDD);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Get today's window in the device's local timezone
export function todayWindowForLocal() {
  const now = DateTime.local();

  const start = now.startOf("day");
  const end = start.plus({ days: 1 });

  return {
    zone: "local",
    startUtcISO: start.toUTC().toISO(),
    endUtcISO: end.toUTC().toISO(),
    startLocalISO: start.toISO(),
    endLocalISO: end.toISO(),
  };
}

export function todayWindowForTZ(tz?: string) {
  // If no timezone provided, use device local time
  if (!tz) {
    return todayWindowForLocal();
  }

  const zone = tz;
  const now = DateTime.now().setZone(zone);

  const start = now.startOf("day");
  const end = start.plus({ days: 1 });

  return {
    zone,
    startUtcISO: start.toUTC().toISO(),
    endUtcISO: end.toUTC().toISO(),
    startLocalISO: start.toISO(),
    endLocalISO: end.toISO(),
  };
}

// liveOrdersWindow function removed - use lib/dates.ts instead

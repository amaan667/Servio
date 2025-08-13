export type AmPm = 'AM' | 'PM';

export function to24h(hour12: number, minute: number, ampm: AmPm): { hour: number; minute: number } {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  return { hour: h, minute };
}

export function buildIsoFromLocal(dateYYYYMMDD: string, hour24: number, minute: number): string {
  // Build ISO assuming local time; rely on Date to convert to UTC ISO string
  const yyyy = dateYYYYMMDD;
  const hh = String(hour24).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${yyyy}T${hh}:${mm}:00`).toISOString();
}

export function isOvernight(startHour: number, startMinute: number, endHour: number, endMinute: number): boolean {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end <= start; // same time or before means cross midnight
}

export function addDaysISO(dateYYYYMMDD: string, days: number): string {
  const d = new Date(dateYYYYMMDD);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}



// Shared date helpers for timezone-aware "today" windows
// Uses only standard Intl APIs to avoid heavy deps

export function todayWindowForTZ(tz: string | undefined) {
  // Build the start of today and start of tomorrow in the provided tz,
  // then convert those instants to UTC ISO strings.
  const zone = tz ?? 'UTC';

  // Format current date components in the target timezone as YYYY-MM-DD
  const todayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Local midnight and next midnight in that timezone
  const startLocal = new Date(`${todayYmd}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

  // Convert those local instants to UTC by rendering with timeZone: 'UTC'
  const toUtcIso = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })).toISOString();

  return {
    startUtcISO: toUtcIso(startLocal),
    endUtcISO: toUtcIso(endLocal),
  };
}

export function isWithinToday(iso: string, tz?: string) {
  const { startUtcISO, endUtcISO } = todayWindowForTZ(tz);
  return iso >= startUtcISO && iso < endUtcISO;
}



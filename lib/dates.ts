// Shared date helpers for timezone-aware "today" windows
// Uses only standard Intl APIs to avoid heavy deps

export function todayWindowForTZ(tz: string | undefined) {
  try {
    // Build the start of today and start of tomorrow in the provided tz,
    // then convert those instants to UTC ISO strings.
    let zone = tz ?? 'UTC';

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
    } catch (error) {
      console.warn(`Invalid timezone "${zone}", falling back to UTC`);
      zone = 'UTC';
    }

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
  } catch (error) {
    console.error('Error in todayWindowForTZ:', error);
    // Fallback to UTC if anything goes wrong
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    return {
      startUtcISO: startOfDay.toISOString(),
      endUtcISO: endOfDay.toISOString(),
    };
  }
}

export function isWithinToday(iso: string, tz?: string) {
  try {
    const { startUtcISO, endUtcISO } = todayWindowForTZ(tz);
    return iso >= startUtcISO && iso < endUtcISO;
  } catch (error) {
    console.error('Error in isWithinToday:', error);
    return false;
  }
}



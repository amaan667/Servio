// Shared date helpers for timezone-aware "today" windows
// Uses only standard Intl APIs to avoid heavy deps

export function todayWindowForTZ(tz: string | undefined) {
  // Build the start of today and start of tomorrow in the provided tz,
  // then convert those instants to UTC ISO strings.
  const zone = tz ?? "UTC";

  // Format current date components in the target timezone as YYYY-MM-DD
  const todayYmd = new Intl.DateTimeFormat("en-CA", {

  }).format(new Date());

  // Local midnight and next midnight in that timezone
  const startLocal = new Date(`${todayYmd}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

  // Convert those local instants to UTC by rendering with timeZone: 'UTC'
  const toUtcIso = (d: Date) =>
    new Date(d.toLocaleString("en-US", { timeZone: "UTC" })).toISOString();

  return {

  };
}

export function isWithinToday(iso: string, tz?: string) {
  const { startUtcISO, endUtcISO } = todayWindowForTZ(tz);
  return iso >= startUtcISO && iso < endUtcISO;
}

// Get the time window for "today + 30 minutes" - only orders from the last 30 minutes
export function todayPlus30MinWindow() {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

  return {

  };
}

// Get the time window for "live orders" - only orders from the last 30 minutes
export function liveOrdersWindow() {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

  const result = {

  };

  return result;
}

// Get the time window for "earlier today" - orders from today but more than 30 minutes ago
export function earlierTodayWindow(tz?: string) {
  const { startUtcISO, endUtcISO } = todayWindowForTZ(tz);

  // Get the live window to use its start time as our end time (exclusive)
  const liveWindow = liveOrdersWindow();

  const result = {
    startUtcISO: startUtcISO, // Start of today
    endUtcISO: liveWindow.startUtcISO, // Start of live window (exclusive)
  };

  return result;
}

// Get the time window for "history" - orders from yesterday and earlier
export function historyWindow(tz?: string) {
  const { startUtcISO } = todayWindowForTZ(tz);

  return {
    startUtcISO: null, // No start limit (all history)
    endUtcISO: startUtcISO, // Before start of today (exclusive)
  };
}

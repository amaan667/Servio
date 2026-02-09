/**
 * Platform-wide locale: country, currency, and timezone.
 * Used for auto-detection and settings override. Currency and time are derived from country.
 */

export interface LocaleInfo {
  countryCode: string;
  countryName: string;
  currency: string;
  timezone: string;
  locale: string;
}

// Curated list: country code -> currency (ISO 4217) and primary IANA timezone
const COUNTRY_LOCALE: Record<string, Omit<LocaleInfo, "countryCode">> = {
  GB: { countryName: "United Kingdom", currency: "GBP", timezone: "Europe/London", locale: "en-GB" },
  US: { countryName: "United States", currency: "USD", timezone: "America/New_York", locale: "en-US" },
  IE: { countryName: "Ireland", currency: "EUR", timezone: "Europe/Dublin", locale: "en-IE" },
  FR: { countryName: "France", currency: "EUR", timezone: "Europe/Paris", locale: "fr-FR" },
  DE: { countryName: "Germany", currency: "EUR", timezone: "Europe/Berlin", locale: "de-DE" },
  ES: { countryName: "Spain", currency: "EUR", timezone: "Europe/Madrid", locale: "es-ES" },
  IT: { countryName: "Italy", currency: "EUR", timezone: "Europe/Rome", locale: "it-IT" },
  NL: { countryName: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam", locale: "nl-NL" },
  AE: { countryName: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai", locale: "ar-AE" },
  SG: { countryName: "Singapore", currency: "SGD", timezone: "Asia/Singapore", locale: "en-SG" },
  JP: { countryName: "Japan", currency: "JPY", timezone: "Asia/Tokyo", locale: "ja-JP" },
  AU: { countryName: "Australia", currency: "AUD", timezone: "Australia/Sydney", locale: "en-AU" },
  CA: { countryName: "Canada", currency: "CAD", timezone: "America/Toronto", locale: "en-CA" },
  IN: { countryName: "India", currency: "INR", timezone: "Asia/Kolkata", locale: "en-IN" },
  PT: { countryName: "Portugal", currency: "EUR", timezone: "Europe/Lisbon", locale: "pt-PT" },
  BE: { countryName: "Belgium", currency: "EUR", timezone: "Europe/Brussels", locale: "nl-BE" },
  CH: { countryName: "Switzerland", currency: "CHF", timezone: "Europe/Zurich", locale: "de-CH" },
  AT: { countryName: "Austria", currency: "EUR", timezone: "Europe/Vienna", locale: "de-AT" },
  PL: { countryName: "Poland", currency: "PLN", timezone: "Europe/Warsaw", locale: "pl-PL" },
  SE: { countryName: "Sweden", currency: "SEK", timezone: "Europe/Stockholm", locale: "sv-SE" },
  NO: { countryName: "Norway", currency: "NOK", timezone: "Europe/Oslo", locale: "nb-NO" },
  DK: { countryName: "Denmark", currency: "DKK", timezone: "Europe/Copenhagen", locale: "da-DK" },
  NZ: { countryName: "New Zealand", currency: "NZD", timezone: "Pacific/Auckland", locale: "en-NZ" },
  MX: { countryName: "Mexico", currency: "MXN", timezone: "America/Mexico_City", locale: "es-MX" },
  BR: { countryName: "Brazil", currency: "BRL", timezone: "America/Sao_Paulo", locale: "pt-BR" },
  ZA: { countryName: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg", locale: "en-ZA" },
  HK: { countryName: "Hong Kong", currency: "HKD", timezone: "Asia/Hong_Kong", locale: "zh-HK" },
};

// Map IANA timezone -> primary country code (for browser timezone detection)
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Lisbon": "PT",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Warsaw": "PL",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Asia/Dubai": "AE",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Kolkata": "IN",
  "Asia/Hong_Kong": "HK",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "Africa/Johannesburg": "ZA",
};

export const COUNTRY_OPTIONS: LocaleInfo[] = Object.entries(COUNTRY_LOCALE).map(([code, info]) => ({
  countryCode: code,
  ...info,
}));

export function getLocaleForCountry(countryCode: string): LocaleInfo | null {
  const upper = countryCode.toUpperCase().slice(0, 2);
  const info = COUNTRY_LOCALE[upper];
  if (!info) return null;
  return { countryCode: upper, ...info };
}

/** Detect country and timezone from browser. Currency is derived from country. */
export function detectBrowserLocale(): LocaleInfo {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) {
    return {
      countryCode: "GB",
      countryName: "United Kingdom",
      currency: "GBP",
      timezone: "Europe/London",
      locale: "en-GB",
    };
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const countryCode = TIMEZONE_TO_COUNTRY[tz] ?? "GB";
  const info = getLocaleForCountry(countryCode);
  if (info) return info;
  return {
    countryCode: "GB",
    countryName: "United Kingdom",
    currency: "GBP",
    timezone: tz || "Europe/London",
    locale: "en-GB",
  };
}

export function getTimezoneForCountry(countryCode: string): string {
  return getLocaleForCountry(countryCode)?.timezone ?? "Europe/London";
}

export function getCurrencyForCountry(countryCode: string): string {
  return getLocaleForCountry(countryCode)?.currency ?? "GBP";
}

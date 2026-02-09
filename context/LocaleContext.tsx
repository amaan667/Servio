"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type LocaleInfo,
  detectBrowserLocale,
  getLocaleForCountry,
} from "@/lib/locale";

type LocaleState = LocaleInfo & {
  /** Apply venue locale (called when venue is loaded in dashboard). */
  setFromVenue: (venue: {
    country?: string | null;
    currency?: string | null;
    timezone?: string | null;
  }) => void;
  /** Format amount in platform currency (auto-detected or from venue). */
  formatCurrency: (amount: number, currencyOverride?: string) => string;
  /** Format date in platform timezone/locale. */
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  /** Format time in platform timezone/locale. */
  formatTime: (date: Date | string) => string;
};

const defaultLocale = detectBrowserLocale();

const LocaleContext = createContext<LocaleState | null>(null);

function formatCurrencyImpl(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<LocaleInfo>(defaultLocale);

  const setFromVenue = useCallback(
    (venue: { country?: string | null; currency?: string | null; timezone?: string | null }) => {
      const fromCountry = venue.country ? getLocaleForCountry(venue.country) : null;
      const currency = (venue.currency as string) || fromCountry?.currency || "GBP";
      const timezone = (venue.timezone as string) || fromCountry?.timezone || "Europe/London";
      if (fromCountry) {
        setLocale({
          ...fromCountry,
          currency,
          timezone,
        });
        return;
      }
      setLocale({
        countryCode: "GB",
        countryName: "United Kingdom",
        currency,
        timezone,
        locale: "en-GB",
      });
    },
    []
  );

  const formatCurrency = useCallback(
    (amount: number, currencyOverride?: string) => {
      const currency = currencyOverride ?? locale.currency;
      return formatCurrencyImpl(amount, currency, locale.locale);
    },
    [locale.currency, locale.locale]
  );

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleDateString(locale.locale, {
        timeZone: locale.timezone,
        ...options,
      });
    },
    [locale.locale, locale.timezone]
  );

  const formatTime = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleTimeString(locale.locale, {
        timeZone: locale.timezone,
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [locale.locale, locale.timezone]
  );

  const value: LocaleState = {
    ...locale,
    setFromVenue,
    formatCurrency,
    formatDate,
    formatTime,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      ...defaultLocale,
      setFromVenue: () => {},
      formatCurrency: (amount: number, currencyOverride?: string) =>
        formatCurrencyImpl(amount, currencyOverride ?? defaultLocale.currency, defaultLocale.locale),
      formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleDateString(defaultLocale.locale, {
          timeZone: defaultLocale.timezone,
          ...options,
        });
      },
      formatTime: (date: Date | string) => {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleTimeString(defaultLocale.locale, {
          timeZone: defaultLocale.timezone,
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    };
  }
  return ctx;
}

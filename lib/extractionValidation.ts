/**
 * Cross-reference validation for extracted menu items.
 * Flags price format consistency, category consistency, and outliers.
 */

export interface ValidationFlags {
  priceFormatConsistent: boolean;
  categoryConsistent: boolean;
  priceOutlier: boolean;
}

export interface ItemWithValidation<T> {
  item: T;
  validation: ValidationFlags;
}

export interface PriceFormatContext {
  dominantDecimals: number;
  dominantCurrency: string | null;
  samplePrices: number[];
}

function getDecimalPlaces(n: number): number {
  const s = String(n);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Detect dominant price format (decimal places) from a list of prices. */
export function detectPriceFormat(prices: number[]): PriceFormatContext {
  const withDecimals = prices.filter((p) => p > 0 && Number.isFinite(p));
  if (withDecimals.length === 0) {
    return { dominantDecimals: 2, dominantCurrency: null, samplePrices: [] };
  }
  const decimalCounts: Record<number, number> = {};
  for (const p of withDecimals) {
    const d = getDecimalPlaces(p);
    decimalCounts[d] = (decimalCounts[d] ?? 0) + 1;
  }
  let dominantDecimals = 2;
  let maxCount = 0;
  for (const [d, c] of Object.entries(decimalCounts)) {
    if (c > maxCount) {
      maxCount = c;
      dominantDecimals = Number(d);
    }
  }
  return {
    dominantDecimals,
    dominantCurrency: null,
    samplePrices: withDecimals.slice(0, 20),
  };
}

/** Check if a single price is an outlier (e.g. far from median). */
export function isPriceOutlier(price: number, allPrices: number[]): boolean {
  if (allPrices.length < 3) return false;
  const sorted = [...allPrices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const iqr = (sorted[Math.floor(sorted.length * 0.75)] ?? median) - (sorted[Math.floor(sorted.length * 0.25)] ?? median);
  const lower = median - 1.5 * iqr;
  const upper = median + 1.5 * iqr;
  return price < lower || price > upper;
}

/** Check if price format matches dominant (decimal places). */
export function isPriceFormatConsistent(
  price: number,
  context: PriceFormatContext
): boolean {
  if (context.samplePrices.length === 0) return true;
  const decimals = getDecimalPlaces(price);
  return decimals === context.dominantDecimals;
}

/** Run cross-reference validation on extracted items. */
export function validateExtractedItems<T extends { price?: number; category?: string }>(
  items: T[]
): ItemWithValidation<T>[] {
  const prices = items.map((i) => i.price).filter((p): p is number => typeof p === "number" && p > 0);
  const categories = items.map((i) => i.category || "Menu Items").filter(Boolean);
  const formatContext = detectPriceFormat(prices);
  const categoryCounts: Record<string, number> = {};
  for (const c of categories) {
    categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
  }
  const genericCategories = new Set(["Menu Items", "Uncategorized", "Other"]);
  const hasNonGeneric = categories.some((c) => !genericCategories.has(c));

  return items.map((item) => {
    const price = item.price;
    const validation: ValidationFlags = {
      priceFormatConsistent: true,
      categoryConsistent: true,
      priceOutlier: false,
    };
    if (typeof price === "number" && price > 0) {
      validation.priceFormatConsistent = isPriceFormatConsistent(price, formatContext);
      validation.priceOutlier = isPriceOutlier(price, prices);
    }
    const cat = item.category || "Menu Items";
    if (hasNonGeneric && genericCategories.has(cat)) {
      validation.categoryConsistent = false;
    }
    return { item, validation };
  });
}

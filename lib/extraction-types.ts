/**
 * Shared types for menu extraction: confidence scoring and cross-reference validation.
 */

export interface ExtractionConfidence {
  name?: number;
  description?: number;
  price?: number;
  category?: number;
  image_url?: number;
}

export interface WithConfidence<T> {
  item: T;
  confidence: ExtractionConfidence;
}

/** Dominant format detected across items (for validation). */
export interface PriceFormatContext {
  dominantDecimals: number;
  dominantCurrency: string | null;
  samplePrices: number[];
}

/** Validation flag for cross-reference checks. */
export interface ValidationFlags {
  priceFormatConsistent: boolean;
  categoryConsistent: boolean;
  priceOutlier: boolean;
}

export function defaultConfidence(): ExtractionConfidence {
  return {
    name: 0.8,
    description: 0.5,
    price: 0.8,
    category: 0.5,
    image_url: 0.5,
  };
}

/** Merge confidence when combining two sources (e.g. Vision + DOM): take max per field. */
export function mergeConfidence(
  a: ExtractionConfidence,
  b: ExtractionConfidence
): ExtractionConfidence {
  return {
    name: Math.max(a.name ?? 0, b.name ?? 0),
    description: Math.max(a.description ?? 0, b.description ?? 0),
    price: Math.max(a.price ?? 0, b.price ?? 0),
    category: Math.max(a.category ?? 0, b.category ?? 0),
    image_url: Math.max(a.image_url ?? 0, b.image_url ?? 0),
  };
}

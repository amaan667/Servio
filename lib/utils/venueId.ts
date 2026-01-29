/**
 * Single source for venue ID normalization.
 * Database stores venue IDs with a "venue-" prefix.
 */

export function normalizeVenueId(venueId: string | null | undefined): string | null {
  if (venueId == null || venueId === "") return null;
  return venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
}

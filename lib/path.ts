export function venuePath(venueId?: string, sub?: string) {
  if (!venueId) return "/";
  return sub ? `/dashboard/${venueId}/${sub}` : `/dashboard/${venueId}`;
}

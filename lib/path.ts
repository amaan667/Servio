export function venuePath(venueId?: string, sub?: string) {
  if (!venueId) return '/dashboard';
  return sub ? `/dashboard/${venueId}/${sub}` : `/dashboard/${venueId}`;
}

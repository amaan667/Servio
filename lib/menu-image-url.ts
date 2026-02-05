/**
 * Return a display URL for a menu item image.
 * External URLs (e.g. nurcafe.co.uk/_next/image) are proxied so they load when the source blocks cross-origin.
 */
export function getMenuImageDisplayUrl(
  imageUrl: string | null | undefined
): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:")) return imageUrl;
  if (imageUrl.startsWith("/")) return imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return `/api/menu/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}

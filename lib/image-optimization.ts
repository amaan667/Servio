/**
 * Image Optimization Utility
 * Provides helpers for optimized image delivery
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  fit?: "cover" | "contain" | "fill";
}

/**
 * Get optimized image URL using Cloudinary (or fallback to original)
 * Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME env var to enable
 */
export function getOptimizedImageUrl(url: string, options: ImageOptimizationOptions = {}): string {
  // Return original if not a valid URL
  if (!url || (!url.startsWith("http") && !url.startsWith("/"))) {
    return url;
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  // If Cloudinary not configured, return original URL
  if (!cloudName) {
    return url;
  }

  const { width = 800, height, quality = 80, format = "auto", fit = "cover" } = options;

  // Build transformation string
  const transforms = [
    width && `w_${width}`,
    height && `h_${height}`,
    `q_${quality}`,
    `f_${format}`,
    `c_${fit}`,
    "dpr_auto", // Auto device pixel ratio
  ]
    .filter(Boolean)
    .join(",");

  // Encode the original URL
  const encodedUrl = encodeURIComponent(url);

  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transforms}/${encodedUrl}`;
}

/**
 * Get blur placeholder for Next.js Image
 */
export function getBlurDataURL(width: number = 10, height: number = 10): string {
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="#f3f4f6" width="${width}" height="${height}"/></svg>`
  ).toString("base64")}`;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;

}

/**
 * Lazy load images with Intersection Observer
 */
export function setupLazyLoading(selector: string = "img[data-src]") {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    return;
  }

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.getAttribute("data-src");

        if (src) {
          img.src = src;
          img.removeAttribute("data-src");
          imageObserver.unobserve(img);
        }
      }

  document.querySelectorAll(selector).forEach((img) => {
    imageObserver.observe(img);

}

/**
 * Image dimension utilities
 */
export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({

    };

    img.onerror = reject;
    img.src = url;

}

/**
 * Check if image exists
 */
export async function imageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get responsive image sizes
 */
export function getResponsiveSizes(type: "menu-item" | "menu-grid" | "logo" | "thumbnail"): string {
  const sizes = {
    "menu-item": "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    "menu-grid": "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px",
    logo: "(max-width: 768px) 200px, 300px",
    thumbnail: "(max-width: 640px) 64px, 96px",
  };

  return sizes[type];
}

/**
 * Optimized Image Component
 * Wrapper around Next.js Image with best practices built-in
 */

import Image, { ImageProps } from "next/image";
import { useState } from "react";

interface OptimizedImageProps extends Omit<ImageProps, "src" | "alt"> {
  src: string | null | undefined;
  alt: string;
  fallbackSrc?: string;
}

const DEFAULT_FALLBACK = "/images/placeholder.svg";

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className,
  ...props
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src || fallbackSrc);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setImageSrc(fallbackSrc);
  };

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (!src) {
    return (
      <Image
        src={fallbackSrc}
        alt={alt}
        className={className}
        onError={handleError}
        onLoad={handleLoadingComplete}
        {...props}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      className={`${className} ${isLoading ? "opacity-70" : "opacity-100"} transition-opacity duration-300`}
      onError={handleError}
      onLoad={handleLoadingComplete}
      quality={85}
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgMSAxIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuMSkiLz48L3N2Zz4="
      {...props}
    />
  );
}

/**
 * Menu Item Image - Pre-configured for menu items
 */
export function MenuItemImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={400}
      height={400}
      className={`object-cover ${className}`}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
    />
  );
}

/**
 * Logo Image - Pre-configured for logos
 */
export function LogoImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={200}
      height={80}
      className={`object-contain ${className}`}
      priority
    />
  );
}

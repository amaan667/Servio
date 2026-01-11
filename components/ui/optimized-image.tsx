"use client";

import { useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {

}

/**
 * Optimized Image Component
 *
 * Features:
 * - Prevents layout shift with reserved space
 * - Smooth fade-in when loaded
 * - Shows placeholder while loading
 * - Handles errors gracefully
 * - No flickering
 */
export function OptimizedImage({
  src,
  alt,
  className,
  aspectRatio = "square",
  fallback,
  objectFit = "cover",
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const aspectRatioClasses = {

  };

  const objectFitClasses = {

  };

  return (
    <div
      className={cn(
        "relative bg-gray-100 overflow-hidden",
        aspectRatioClasses[aspectRatio],
        className
      )}
    >
      {/* Placeholder (shows while loading or on error) */}
      {(!loaded || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          {fallback || <ImageIcon className="h-12 w-12 text-gray-300" />}
        </div>
      )}

      {/* Real image */}
      {!error && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full transition-opacity duration-300",
            objectFitClasses[objectFit],
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}

/**
 * Menu Item Image (specific use case)
 */
export function MenuItemImage({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="w-full aspect-square bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
        <ImageIcon className="h-16 w-16 text-purple-300" />
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={name}
      aspectRatio="square"
      fallback={
        <div className="flex flex-col items-center justify-center">
          <ImageIcon className="h-12 w-12 text-gray-300 mb-2" />
          <span className="text-xs text-gray-400">{name}</span>
        </div>
      }
    />
  );
}

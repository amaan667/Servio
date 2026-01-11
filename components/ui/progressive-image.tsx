"use client";

import { useState } from "react";
import Image from "next/image";

interface ProgressiveImageProps {

}

export function ProgressiveImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  blurDataURL,
}: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
        className={`
          duration-700 ease-in-out
          ${isLoading ? "scale-110 blur-lg" : "scale-100 blur-0"}
        `}
        onLoadingComplete={() => setIsLoading(false)}
      />
    </div>
  );
}

// Utility to generate blur data URL
export function shimmer(w: number, h: number) {
  return `
    <svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#f6f7f8" offset="0%" />
          <stop stop-color="#edeef1" offset="20%" />
          <stop stop-color="#f6f7f8" offset="40%" />
          <stop stop-color="#f6f7f8" offset="100%" />
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="#f6f7f8" />
      <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
    </svg>
  `;
}

export function toBase64(str: string) {
  return typeof window === "undefined" ? Buffer.from(str).toString("base64") : window.btoa(str);
}

export function getBlurDataURL(w: number, h: number) {
  return `data:image/svg+xml;base64,${toBase64(shimmer(w, h))}`;
}

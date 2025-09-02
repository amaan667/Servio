"use client";

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

interface MenuItemImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export default function MenuItemImage({ 
  src, 
  alt, 
  className = "w-20 h-20 rounded-lg object-cover border border-gray-200",
  fallbackIcon = <UtensilsCrossed className="w-8 w-8 text-gray-400" />
}: MenuItemImageProps) {
  const [hasError, setHasError] = useState(false);

  console.log('[IMAGE DEBUG] Rendering image:', { src, alt, hasError });

  if (hasError) {
    console.log('[IMAGE DEBUG] Showing fallback for:', src);
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        {fallbackIcon}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        console.log('[IMAGE DEBUG] Image failed to load:', src);
        setHasError(true);
      }}
      onLoad={() => console.log('[IMAGE DEBUG] Image loaded successfully:', src)}
      loading="lazy"
    />
  );
}

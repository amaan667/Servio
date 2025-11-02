"use client";

import { useState, memo } from "react";
import { UtensilsCrossed, ImageOff } from "lucide-react";

interface MenuItemImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  showLoadingState?: boolean;
}

const MenuItemImage = memo(function MenuItemImage({
  src,
  alt,
  className = "w-20 h-20 rounded-lg object-contain border border-gray-200",
  fallbackIcon: _fallbackIcon = <UtensilsCrossed className="w-8 h-8 text-gray-700" />,
  showLoadingState = true,
}: MenuItemImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  // Show loading state
  if (showLoadingState && isLoading) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <div className="text-center">
          <ImageOff className="w-6 h-6 text-gray-700 mx-auto mb-1" />
          <span className="text-xs text-gray-900">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={handleImageLoad}
      onError={handleImageError}
      loading="lazy"
      style={{
        transition: "opacity 0.2s ease-in-out",
        opacity: isLoading ? 0 : 1,
      }}
    />
  );
});

export default MenuItemImage;

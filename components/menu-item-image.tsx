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
  className = "rounded-lg border border-gray-200",
  fallbackIcon: _fallbackIcon = <UtensilsCrossed className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />,
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
      <div
        className={`${className} bg-white border border-gray-200 flex items-center justify-center`}
        style={{ width: "90px", height: "90px" }}
      >
        <div className="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div
        className={`${className} bg-white border border-gray-200 flex items-center justify-center`}
        style={{ width: "90px", height: "90px" }}
      >
        <div className="text-center">
          <ImageOff className="w-4 h-4 sm:w-6 sm:h-6 text-gray-700 mx-auto mb-1" />
          <span className="text-xs text-gray-900">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${className} bg-white border border-gray-200 overflow-hidden`}
      style={{ width: "90px", height: "90px" }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        style={{
          transition: "opacity 0.2s ease-in-out",
          opacity: isLoading ? 0 : 1,
          objectPosition: "center",
        }}
      />
    </div>
  );
});

export default MenuItemImage;

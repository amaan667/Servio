"use client";

import { useEffect, useState } from "react";

interface ClientOnlyWrapperProps {

}

/**
 * Wrapper component that only renders children on the client side
 * Prevents SSR issues with browser API dependent components
 */
export default function ClientOnlyWrapper({
  children,
  fallback = null
}: ClientOnlyWrapperProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      // SSR / test guard
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    if (!mql) {
      return;
    }

    const hasAddEvent =
      typeof mql.addEventListener === "function" ||
      typeof (mql as unknown as { addListener?: (cb: () => void) => void }).addListener ===
        "function";
    if (!hasAddEvent) {
      return;
    }
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else if (
      typeof (mql as unknown as { addListener?: (cb: () => void) => void }).addListener ===
      "function"
    ) {
      (mql as unknown as { addListener: (cb: () => void) => void }).addListener(onChange);
    }

    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else if (
        typeof (mql as unknown as { removeListener?: (cb: () => void) => void }).removeListener ===
        "function"
      ) {
        (mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(onChange);
      }
    };
  }, []);

  // Return the actual value (undefined, true, or false)
  // Don't convert to boolean to allow components to detect loading state
  return isMobile;
}

export function useWindowSize() {
  const [windowSize, setWindowSize] = React.useState({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

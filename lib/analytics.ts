// Analytics utilities for Servio
// Supports Google Analytics and Plausible

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    plausible?: (...args: unknown[]) => void;
  }
}

// Google Analytics
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

// Page view tracking
export const pageview = (url: string) => {
  if (typeof window === 'undefined') return;
  
  // Google Analytics
  if (GA_TRACKING_ID && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
  
  // Plausible
  if (window.plausible) {
    window.plausible('pageview');
  }
};

// Event tracking
interface AnalyticsEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
}

export const event = ({ action, category, label, value }: AnalyticsEvent) => {
  if (typeof window === 'undefined') return;
  
  // Google Analytics
  if (GA_TRACKING_ID && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
  
  // Plausible (custom events)
  if (window.plausible) {
    window.plausible(action, {
      props: {
        category,
        label,
        value,
      },
    });
  }
};

// Common events
export const trackSignUp = () => {
  event({
    action: 'sign_up',
    category: 'engagement',
    label: 'User signed up',
  });
};

export const trackTrial = (plan: string) => {
  event({
    action: 'start_trial',
    category: 'conversion',
    label: plan,
  });
};

export const trackUpgrade = (from: string, to: string) => {
  event({
    action: 'upgrade',
    category: 'conversion',
    label: `${from}_to_${to}`,
  });
};

export const trackDemoView = () => {
  event({
    action: 'view_demo',
    category: 'engagement',
    label: 'Demo page viewed',
  });
};

export const trackOrder = (value: number) => {
  event({
    action: 'place_order',
    category: 'conversion',
    label: 'Order placed',
    value,
  });
};


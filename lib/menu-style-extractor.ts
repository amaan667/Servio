/**
 * Menu Style Extractor
 * Extracts visual style information from PDF menus for rendering
 */

export interface MenuStyle {
  // Colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;

  // Typography
  font_family: string;
  font_size: "small" | "medium" | "large";
  heading_font_size: number;
  body_font_size: number;

  // Layout
  layout: "single-column" | "two-column" | "three-column";
  alignment: "left" | "center" | "right";
  spacing: "compact" | "normal" | "spacious";

  // Branding
  logo_url?: string;
  logo_size_numeric?: number; // Logo size in pixels (80-400)
  custom_heading?: string; // Custom text below logo
  venue_name?: string;

  // Display Options
  show_descriptions: boolean;
  show_prices: boolean;
  show_images: boolean;

  // Detected from PDF
  detected_primary_color?: string;
  detected_secondary_color?: string;
  detected_layout?: string;
}

/**
 * Extract color palette from text analysis
 * Uses common patterns and OCR text to detect colors
 */
export function extractColorsFromText(text: string): {
  primary: string;
  secondary: string;
  accent: string;
} {
  // Default colors
  let primary = "#8b5cf6"; // Purple
  let secondary = "#f3f4f6"; // Gray
  let accent = "#10b981"; // Green

  // Common color keywords in menus
  const colorKeywords = {
    primary: [
      "red",
      "crimson",
      "burgundy",
      "maroon",
      "purple",
      "violet",
      "blue",
      "navy",
      "black",
      "dark",
    ],
    secondary: ["gray", "grey", "silver", "light", "white", "beige", "cream", "tan"],
    accent: ["gold", "yellow", "orange", "amber", "green", "teal", "lime"],
  };

  const lowerText = text.toLowerCase();

  // Look for color keywords
  for (const [type, keywords] of Object.entries(colorKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (type === "primary") {
          primary = getColorForKeyword(keyword);
        } else if (type === "secondary") {
          secondary = getColorForKeyword(keyword);
        } else if (type === "accent") {
          accent = getColorForKeyword(keyword);
        }
        break;
      }
    }
  }

  return { primary, secondary, accent };
}

function getColorForKeyword(keyword: string): string {
  const colorMap: Record<string, string> = {
    red: "#ef4444",
    crimson: "#dc2626",
    burgundy: "#991b1b",
    maroon: "#800000",
    purple: "#8b5cf6",
    violet: "#7c3aed",
    blue: "#3b82f6",
    navy: "#1e3a8a",
    black: "#000000",
    dark: "#1f2937",
    gray: "#6b7280",
    grey: "#6b7280",
    silver: "#9ca3af",
    light: "#f3f4f6",
    white: "#ffffff",
    beige: "#f5f5dc",
    cream: "#fffdd0",
    tan: "#d2b48c",
    gold: "#fbbf24",
    yellow: "#facc15",
    orange: "#fb923c",
    amber: "#f59e0b",
    green: "#10b981",
    teal: "#14b8a6",
    lime: "#84cc16",
  };

  return colorMap[keyword] || "#8b5cf6";
}

/**
 * Detect layout from text structure
 */
export function detectLayout(text: string): "single-column" | "two-column" | "three-column" {
  const lines = text.split("\n");
  const maxLineLength = Math.max(...lines.map((line) => line.length));

  // If lines are very short, likely multi-column
  if (maxLineLength < 40) {
    return "three-column";
  } else if (maxLineLength < 60) {
    return "two-column";
  }

  return "single-column";
}

/**
 * Detect font size from text density
 */
export function detectFontSize(text: string): "small" | "medium" | "large" {
  const lines = text.split("\n");
  const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;

  // More text per line = smaller font
  if (avgLineLength > 80) {
    return "small";
  } else if (avgLineLength > 50) {
    return "medium";
  }

  return "large";
}

/**
 * Extract style from PDF text content
 */
export function extractStyleFromPDF(text: string, logoUrl?: string, venueName?: string): MenuStyle {
  const colors = extractColorsFromText(text);
  const layout = detectLayout(text);
  const fontSize = detectFontSize(text);

  return {
    primary_color: colors.primary,
    secondary_color: colors.secondary,
    accent_color: colors.accent,
    background_color: "#ffffff",
    text_color: "#1f2937",

    font_family: "inter",
    font_size: fontSize,
    heading_font_size: fontSize === "small" ? 20 : fontSize === "medium" ? 24 : 28,
    body_font_size: fontSize === "small" ? 14 : fontSize === "medium" ? 16 : 18,

    layout,
    alignment: "left",
    spacing: "normal",

    logo_url: logoUrl,
    venue_name: venueName,

    show_descriptions: true,
    show_prices: true,
    show_images: false,

    detected_primary_color: colors.primary,
    detected_secondary_color: colors.secondary,
    detected_layout: layout,
  };
}

/**
 * Get CSS classes for menu rendering based on style
 */
export function getMenuStyleClasses(style: MenuStyle): {
  container: string;
  category: string;
  item: string;
  price: string;
  description: string;
} {
  const layoutClasses = {
    "single-column": "grid grid-cols-1 gap-6",
    "two-column": "grid grid-cols-1 md:grid-cols-2 gap-6",
    "three-column": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  };

  const fontSizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  return {
    container: layoutClasses[style.layout] || layoutClasses["single-column"],
    category: `text-${style.font_size === "small" ? "xl" : style.font_size === "medium" ? "2xl" : "3xl"} font-bold mb-4`,
    item: fontSizeClasses[style.font_size],
    price: `text-${style.font_size === "small" ? "base" : style.font_size === "medium" ? "lg" : "xl"} font-semibold`,
    description: fontSizeClasses[style.font_size],
  };
}

const FONT_MAP: { [key: string]: string } = {

  "source-sans": "Source Sans Pro",

  "libre-baskerville": "Libre Baskerville",
  "dancing-script": "Dancing Script",

  "bebas-neue": "Bebas Neue",

  "fira-sans": "Fira Sans",
  "work-sans": "Work Sans",

};

export const loadFont = (fontFamily: string) => {
  // Only run on client side to prevent SSR errors
  if (typeof document === "undefined") return;

  const existingLink = document.querySelector(`link[href*="${fontFamily.replace(" ", "+")}"]`);
  if (existingLink) return;

  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(" ", "+")}:wght@300;400;500;600;700&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
};

export const loadFontForFamily = (fontFamilyKey: string) => {
  const fontName = FONT_MAP[fontFamilyKey];
  if (fontName) {
    loadFont(fontName);
  }
};

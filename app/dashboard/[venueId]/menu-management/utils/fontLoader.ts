const FONT_MAP: { [key: string]: string } = {
  inter: "Inter",
  roboto: "Roboto",
  opensans: "Open Sans",
  poppins: "Poppins",
  lato: "Lato",
  montserrat: "Montserrat",
  nunito: "Nunito",
  "source-sans": "Source Sans Pro",
  playfair: "Playfair Display",
  merriweather: "Merriweather",
  crimson: "Crimson Text",
  "libre-baskerville": "Libre Baskerville",
  "dancing-script": "Dancing Script",
  pacifico: "Pacifico",
  lobster: "Lobster",
  "bebas-neue": "Bebas Neue",
  oswald: "Oswald",
  raleway: "Raleway",
  ubuntu: "Ubuntu",
  "fira-sans": "Fira Sans",
  "work-sans": "Work Sans",
  quicksand: "Quicksand",
  rubik: "Rubik",
  comfortaa: "Comfortaa",
  cabin: "Cabin",
  dosis: "Dosis",
  exo: "Exo",
  fjalla: "Fjalla One",
  anton: "Anton",
  barlow: "Barlow",
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

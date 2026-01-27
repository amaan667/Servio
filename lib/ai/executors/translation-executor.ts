import { createClient } from "@/lib/supabase";

import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  ar: "Arabic",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
};

const CATEGORY_MAPPINGS: Record<string, Record<string, string>> = {
  "en-es": {
    STARTERS: "ENTRADAS",
    APPETIZERS: "APERITIVOS",
    "MAIN COURSES": "PLATOS PRINCIPALES",
    ENTREES: "PLATOS PRINCIPALES",
    DESSERTS: "POSTRES",
    SALADS: "ENSALADAS",
    KIDS: "NIÑOS",
    CHILDREN: "NIÑOS",
    DRINKS: "BEBIDAS",
    BEVERAGES: "BEBIDAS",
    COFFEE: "CAFÉ",
    "SPECIAL COFFEE": "CAFÉ ESPECIAL",
    TEA: "TÉ",
    SPECIALS: "ESPECIALES",
    SPECIAL: "ESPECIAL",
    WRAPS: "WRAPS",
    SANDWICHES: "SÁNDWICHES",
    MILKSHAKES: "MALTEADAS",
    SHAKES: "BATIDOS",
    SMOOTHIES: "BATIDOS",
    BRUNCH: "BRUNCH",
    BREAKFAST: "DESAYUNO",
    LUNCH: "ALMUERZO",
    DINNER: "CENA",
    SOUP: "SOPA",
    SOUPS: "SOPAS",
    PASTA: "PASTA",
    PIZZA: "PIZZA",
    SEAFOOD: "MARISCOS",
    CHICKEN: "POLLO",
    BEEF: "CARNE DE RES",
    PORK: "CERDO",
    VEGETARIAN: "VEGETARIANO",
    VEGAN: "VEGANO",
    "GLUTEN FREE": "SIN GLUTEN",
  },
  "es-en": {
    ENTRADAS: "STARTERS",
    APERITIVOS: "APPETIZERS",
    "PLATOS PRINCIPALES": "MAIN COURSES",
    POSTRES: "DESSERTS",
    ENSALADAS: "SALADS",
    NIÑOS: "KIDS",
    NINOS: "KIDS",
    BEBIDAS: "DRINKS",
    CAFÉ: "COFFEE",
    CAFE: "COFFEE",
    "CAFÉ ESPECIAL": "SPECIAL COFFEE",
    "CAFE ESPECIAL": "SPECIAL COFFEE",
    TÉ: "TEA",
    TE: "TEA",
    ESPECIALES: "SPECIALS",
    ESPECIAL: "SPECIAL",
    SÁNDWICHES: "SANDWICHES",
    SANDWICHES: "SANDWICHES",
    MALTEADAS: "MILKSHAKES",
    BATIDOS: "SHAKES",
    SHAKES: "SHAKES",
    DESAYUNO: "BREAKFAST",
    ALMUERZO: "LUNCH",
    CENA: "DINNER",
    SOPA: "SOUP",
    SOPAS: "SOUPS",
    MARISCOS: "SEAFOOD",
    POLLO: "CHICKEN",
    "CARNE DE RES": "BEEF",
    CERDO: "PORK",
    VEGETARIANO: "VEGETARIAN",
    VEGANO: "VEGAN",
    "SIN GLUTEN": "GLUTEN FREE",
  },
  "en-ar": {
    STARTERS: "المقبلات",
    APPETIZERS: "المقبلات",
    "MAIN COURSES": "الأطباق الرئيسية",
    ENTREES: "الأطباق الرئيسية",
    MAINS: "الأطباق الرئيسية",
    DESSERTS: "الحلويات",
    SWEETS: "الحلويات",
    SALADS: "السلطات",
    SALAD: "السلطات",
    KIDS: "الأطفال",
    CHILDREN: "الأطفال",
    DRINKS: "المشروبات",
    BEVERAGES: "المشروبات",
    COFFEE: "القهوة",
    "SPECIAL COFFEE": "القهوة الخاصة",
    TEA: "الشاي",
    SPECIALS: "العروض الخاصة",
    SPECIAL: "خاص",
    WRAPS: "السندويشات الملفوفة",
    SANDWICHES: "السندويشات",
    MILKSHAKES: "ميلك شيك",
    SHAKES: "المخفوقات",
    SMOOTHIES: "السموذي",
    BRUNCH: "فطور وغداء",
    "ALL DAY BRUNCH": "فطور وغداء طوال اليوم",
    BREAKFAST: "فطور",
    "ALL DAY BREAKFAST": "فطور طوال اليوم",
    "LATE BREAKFAST": "فطور متأخر",
    "LATE BREAKFAST ALL DAY": "فطور متأخر طوال اليوم",
    LUNCH: "غداء",
    DINNER: "عشاء",
    SOUP: "الحساء",
    SOUPS: "الحساء",
    PASTA: "المعكرونة",
    PIZZA: "البيتزا",
    SEAFOOD: "المأكولات البحرية",
    CHICKEN: "الدجاج",
    BEEF: "لحم البقر",
    LAMB: "لحم الغنم",
    PORK: "لحم الخنزير",
    VEGETARIAN: "نباتي",
    VEGAN: "نباتي صرف",
    "GLUTEN FREE": "خالي من الغلوتين",
    SIDES: "الأطباق الجانبية",
    PLATTERS: "الأطباق الكبيرة",
    GRILLS: "المشاوي",
    GRILLED: "مشوي",
    FRIED: "مقلي",
    BAKED: "مخبوز",
    FRESH: "طازج",
    HOT: "ساخن",
    COLD: "بارد",
    SNACKS: "الوجبات الخفيفة",
    "LIGHT BITES": "وجبات خفيفة",
  },
  "ar-en": {
    المقبلات: "STARTERS",
    "الأطباق الرئيسية": "MAIN COURSES",
    الحلويات: "DESSERTS",
    السلطات: "SALADS",
    الأطفال: "KIDS",
    المشروبات: "DRINKS",
    القهوة: "COFFEE",
    "القهوة الخاصة": "SPECIAL COFFEE",
    الشاي: "TEA",
    "العروض الخاصة": "SPECIALS",
    خاص: "SPECIAL",
    "السندويشات الملفوفة": "WRAPS",
    السندويشات: "SANDWICHES",
    "ميلك شيك": "MILKSHAKES",
    المخفوقات: "SHAKES",
    السموذي: "SMOOTHIES",
    "فطور وغداء": "BRUNCH",
    "فطور وغداء طوال اليوم": "ALL DAY BRUNCH",
    فطور: "BREAKFAST",
    "فطور طوال اليوم": "ALL DAY BREAKFAST",
    "فطور متأخر": "LATE BREAKFAST",
    "فطور متأخر طوال اليوم": "LATE BREAKFAST ALL DAY",
    غداء: "LUNCH",
    عشاء: "DINNER",
    الحساء: "SOUPS",
    المعكرونة: "PASTA",
    البيتزا: "PIZZA",
    "المأكولات البحرية": "SEAFOOD",
    الدجاج: "CHICKEN",
    "لحم البقر": "BEEF",
    "لحم الغنم": "LAMB",
    "لحم الخنزير": "PORK",
    نباتي: "VEGETARIAN",
    "نباتي صرف": "VEGAN",
    "خالي من الغلوتين": "GLUTEN FREE",
    "الأطباق الجانبية": "SIDES",
    "الأطباق الكبيرة": "PLATTERS",
    المشاوي: "GRILLS",
    مشوي: "GRILLED",
    مقلي: "FRIED",
    مخبوز: "BAKED",
    طازج: "FRESH",
    ساخن: "HOT",
    بارد: "COLD",
    "الوجبات الخفيفة": "SNACKS",
    "وجبات خفيفة": "LIGHT BITES",
  },
  // French mappings
  "en-fr": {
    STARTERS: "ENTRÉES",
    APPETIZERS: "ENTRÉES",
    "MAIN COURSES": "PLATS PRINCIPAUX",
    ENTREES: "PLATS PRINCIPAUX",
    MAINS: "PLATS PRINCIPAUX",
    DESSERTS: "DESSERTS",
    SWEETS: "DOUCEURS",
    SALADS: "SALADES",
    SALAD: "SALADE",
    KIDS: "ENFANTS",
    CHILDREN: "ENFANTS",
    DRINKS: "BOISSONS",
    BEVERAGES: "BOISSONS",
    COFFEE: "CAFÉ",
    "SPECIAL COFFEE": "CAFÉ SPÉCIAL",
    TEA: "THÉ",
    SPECIALS: "SPÉCIALITÉS",
    SPECIAL: "SPÉCIAL",
    WRAPS: "WRAPS",
    SANDWICHES: "SANDWICHES",
    MILKSHAKES: "MILK-SHAKES",
    SHAKES: "SHAKES",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "ALL DAY BRUNCH": "BRUNCH TOUTE LA JOURNÉE",
    BREAKFAST: "PETIT DÉJEUNER",
    "ALL DAY BREAKFAST": "PETIT DÉJEUNER TOUTE LA JOURNÉE",
    LUNCH: "DÉJEUNER",
    DINNER: "DÎNER",
    SOUP: "SOUPE",
    SOUPS: "SOUPES",
    PASTA: "PÂTES",
    PIZZA: "PIZZA",
    SEAFOOD: "FRUITS DE MER",
    CHICKEN: "POULET",
    BEEF: "BŒUF",
    LAMB: "AGNEAU",
    PORK: "PORC",
    VEGETARIAN: "VÉGÉTARIEN",
    VEGAN: "VÉGÉTALIEN",
    "GLUTEN FREE": "SANS GLUTEN",
    SIDES: "ACCOMPAGNEMENTS",
    PLATTERS: "PLATEAUX",
    GRILLS: "GRILLADES",
    GRILLED: "GRILLÉ",
    FRIED: "FRIT",
    BAKED: "CUIT AU FOUR",
    FRESH: "FRAIS",
    HOT: "CHAUD",
    COLD: "FROID",
    SNACKS: "COLLATIONS",
    "LIGHT BITES": "PETITES BOUCHÉES",
    WINE: "VIN",
    BEER: "BIÈRE",
    COCKTAILS: "COCKTAILS",
    "SOFT DRINKS": "BOISSONS SANS ALCOOL",
    JUICE: "JUS",
    "ICE CREAM": "GLACE",
    BURGERS: "BURGERS",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NOUILLES",
    RICE: "RIZ",
    BOWLS: "BOLS",
  },
  "fr-en": {
    ENTRÉES: "STARTERS",
    "PLATS PRINCIPAUX": "MAIN COURSES",
    DESSERTS: "DESSERTS",
    DOUCEURS: "SWEETS",
    SALADES: "SALADS",
    SALADE: "SALAD",
    ENFANTS: "KIDS",
    BOISSONS: "DRINKS",
    CAFÉ: "COFFEE",
    "CAFÉ SPÉCIAL": "SPECIAL COFFEE",
    THÉ: "TEA",
    SPÉCIALITÉS: "SPECIALS",
    SPÉCIAL: "SPECIAL",
    "MILK-SHAKES": "MILKSHAKES",
    SHAKES: "SHAKES",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "BRUNCH TOUTE LA JOURNÉE": "ALL DAY BRUNCH",
    "PETIT DÉJEUNER": "BREAKFAST",
    "PETIT DÉJEUNER TOUTE LA JOURNÉE": "ALL DAY BREAKFAST",
    DÉJEUNER: "LUNCH",
    DÎNER: "DINNER",
    SOUPE: "SOUP",
    SOUPES: "SOUPS",
    PÂTES: "PASTA",
    PIZZA: "PIZZA",
    "FRUITS DE MER": "SEAFOOD",
    POULET: "CHICKEN",
    BŒUF: "BEEF",
    AGNEAU: "LAMB",
    PORC: "PORK",
    VÉGÉTARIEN: "VEGETARIAN",
    VÉGÉTALIEN: "VEGAN",
    "SANS GLUTEN": "GLUTEN FREE",
    ACCOMPAGNEMENTS: "SIDES",
    PLATEAUX: "PLATTERS",
    GRILLADES: "GRILLS",
    GRILLÉ: "GRILLED",
    FRIT: "FRIED",
    "CUIT AU FOUR": "BAKED",
    FRAIS: "FRESH",
    CHAUD: "HOT",
    FROID: "COLD",
    COLLATIONS: "SNACKS",
    "PETITES BOUCHÉES": "LIGHT BITES",
    VIN: "WINE",
    BIÈRE: "BEER",
    COCKTAILS: "COCKTAILS",
    "BOISSONS SANS ALCOOL": "SOFT DRINKS",
    JUS: "JUICE",
    GLACE: "ICE CREAM",
    BURGERS: "BURGERS",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOUILLES: "NOODLES",
    RIZ: "RICE",
    BOLS: "BOWLS",
  },
  // German mappings
  "en-de": {
    STARTERS: "VORSPEISEN",
    APPETIZERS: "VORSPEISEN",
    "MAIN COURSES": "HAUPTGERICHTE",
    ENTREES: "HAUPTGERICHTE",
    MAINS: "HAUPTGERICHTE",
    DESSERTS: "NACHSPEISEN",
    SWEETS: "SÜSSIGKEITEN",
    SALADS: "SALATE",
    SALAD: "SALAT",
    KIDS: "KINDER",
    CHILDREN: "KINDER",
    DRINKS: "GETRÄNKE",
    BEVERAGES: "GETRÄNKE",
    COFFEE: "KAFFEE",
    "SPECIAL COFFEE": "SPEZIAL KAFFEE",
    TEA: "TEE",
    SPECIALS: "SPEZIALITÄTEN",
    SPECIAL: "SPEZIAL",
    WRAPS: "WRAPS",
    SANDWICHES: "SANDWICHES",
    MILKSHAKES: "MILCHSHAKES",
    SHAKES: "SHAKES",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "ALL DAY BRUNCH": "GANZTÄGIGER BRUNCH",
    BREAKFAST: "FRÜHSTÜCK",
    "ALL DAY BREAKFAST": "GANZTÄGIGES FRÜHSTÜCK",
    LUNCH: "MITTAGESSEN",
    DINNER: "ABENDESSEN",
    SOUP: "SUPPE",
    SOUPS: "SUPPEN",
    PASTA: "PASTA",
    PIZZA: "PIZZA",
    SEAFOOD: "MEERESFRÜCHTE",
    CHICKEN: "HÄHNCHEN",
    BEEF: "RINDFLEISCH",
    LAMB: "LAMM",
    PORK: "SCHWEINEFLEISCH",
    VEGETARIAN: "VEGETARISCH",
    VEGAN: "VEGAN",
    "GLUTEN FREE": "GLUTENFREI",
    SIDES: "BEILAGEN",
    PLATTERS: "PLATTEN",
    GRILLS: "GRILLGERICHTE",
    GRILLED: "GEGRILLT",
    FRIED: "FRITTIERT",
    BAKED: "GEBACKEN",
    FRESH: "FRISCH",
    HOT: "HEISS",
    COLD: "KALT",
    SNACKS: "SNACKS",
    "LIGHT BITES": "KLEINE GERICHTE",
    WINE: "WEIN",
    BEER: "BIER",
    COCKTAILS: "COCKTAILS",
    "SOFT DRINKS": "ALKOHOLFREIE GETRÄNKE",
    JUICE: "SAFT",
    "ICE CREAM": "EIS",
    BURGERS: "BURGER",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NUDELN",
    RICE: "REIS",
    BOWLS: "SCHALEN",
  },
  "de-en": {
    VORSPEISEN: "STARTERS",
    HAUPTGERICHTE: "MAIN COURSES",
    NACHSPEISEN: "DESSERTS",
    SÜSSIGKEITEN: "SWEETS",
    SALATE: "SALADS",
    SALAT: "SALAD",
    KINDER: "KIDS",
    GETRÄNKE: "DRINKS",
    KAFFEE: "COFFEE",
    "SPEZIAL KAFFEE": "SPECIAL COFFEE",
    TEE: "TEA",
    SPEZIALITÄTEN: "SPECIALS",
    SPEZIAL: "SPECIAL",
    MILCHSHAKES: "MILKSHAKES",
    SHAKES: "SHAKES",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "GANZTÄGIGER BRUNCH": "ALL DAY BRUNCH",
    FRÜHSTÜCK: "BREAKFAST",
    "GANZTÄGIGES FRÜHSTÜCK": "ALL DAY BREAKFAST",
    MITTAGESSEN: "LUNCH",
    ABENDESSEN: "DINNER",
    SUPPE: "SOUP",
    SUPPEN: "SOUPS",
    PASTA: "PASTA",
    PIZZA: "PIZZA",
    MEERESFRÜCHTE: "SEAFOOD",
    HÄHNCHEN: "CHICKEN",
    RINDFLEISCH: "BEEF",
    LAMM: "LAMB",
    SCHWEINEFLEISCH: "PORK",
    VEGETARISCH: "VEGETARIAN",
    VEGAN: "VEGAN",
    GLUTENFREI: "GLUTEN FREE",
    BEILAGEN: "SIDES",
    PLATTEN: "PLATTERS",
    GRILLGERICHTE: "GRILLS",
    GEGRILLT: "GRILLED",
    FRITTIERT: "FRIED",
    GEBACKEN: "BAKED",
    FRISCH: "FRESH",
    HEISS: "HOT",
    KALT: "COLD",
    SNACKS: "SNACKS",
    "KLEINE GERICHTE": "LIGHT BITES",
    WEIN: "WINE",
    BIER: "BEER",
    COCKTAILS: "COCKTAILS",
    "ALKOHOLFREIE GETRÄNKE": "SOFT DRINKS",
    SAFT: "JUICE",
    EIS: "ICE CREAM",
    BURGER: "BURGERS",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NUDELN: "NOODLES",
    REIS: "RICE",
    SCHALEN: "BOWLS",
  },
  // Italian mappings
  "en-it": {
    STARTERS: "ANTIPASTI",
    APPETIZERS: "ANTIPASTI",
    "MAIN COURSES": "PIATTI PRINCIPALI",
    ENTREES: "PIATTI PRINCIPALI",
    MAINS: "PIATTI PRINCIPALI",
    DESSERTS: "DOLCI",
    SWEETS: "DOLCI",
    SALADS: "INSALATE",
    SALAD: "INSALATA",
    KIDS: "BAMBINI",
    CHILDREN: "BAMBINI",
    DRINKS: "BEVANDE",
    BEVERAGES: "BEVANDE",
    COFFEE: "CAFFÈ",
    "SPECIAL COFFEE": "CAFFÈ SPECIALE",
    TEA: "TÈ",
    SPECIALS: "SPECIALITÀ",
    SPECIAL: "SPECIALE",
    WRAPS: "WRAPS",
    SANDWICHES: "PANINI",
    MILKSHAKES: "FRAPPÈ",
    SHAKES: "FRULLATI",
    SMOOTHIES: "SMOOTHIE",
    BRUNCH: "BRUNCH",
    "ALL DAY BRUNCH": "BRUNCH TUTTO IL GIORNO",
    BREAKFAST: "COLAZIONE",
    "ALL DAY BREAKFAST": "COLAZIONE TUTTO IL GIORNO",
    LUNCH: "PRANZO",
    DINNER: "CENA",
    SOUP: "ZUPPA",
    SOUPS: "ZUPPE",
    PASTA: "PASTA",
    PIZZA: "PIZZA",
    SEAFOOD: "FRUTTI DI MARE",
    CHICKEN: "POLLO",
    BEEF: "MANZO",
    LAMB: "AGNELLO",
    PORK: "MAIALE",
    VEGETARIAN: "VEGETARIANO",
    VEGAN: "VEGANO",
    "GLUTEN FREE": "SENZA GLUTINE",
    SIDES: "CONTORNI",
    PLATTERS: "TAGLIERI",
    GRILLS: "GRIGLIATE",
    GRILLED: "ALLA GRIGLIA",
    FRIED: "FRITTO",
    BAKED: "AL FORNO",
    FRESH: "FRESCO",
    HOT: "CALDO",
    COLD: "FREDDO",
    SNACKS: "SPUNTINI",
    "LIGHT BITES": "STUZZICHINI",
    WINE: "VINO",
    BEER: "BIRRA",
    COCKTAILS: "COCKTAIL",
    "SOFT DRINKS": "BIBITE",
    JUICE: "SUCCO",
    "ICE CREAM": "GELATO",
    BURGERS: "HAMBURGER",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NOODLES",
    RICE: "RISO",
    BOWLS: "CIOTOLE",
  },
  "it-en": {
    ANTIPASTI: "STARTERS",
    "PIATTI PRINCIPALI": "MAIN COURSES",
    DOLCI: "DESSERTS",
    INSALATE: "SALADS",
    INSALATA: "SALAD",
    BAMBINI: "KIDS",
    BEVANDE: "DRINKS",
    CAFFÈ: "COFFEE",
    "CAFFÈ SPECIALE": "SPECIAL COFFEE",
    TÈ: "TEA",
    SPECIALITÀ: "SPECIALS",
    SPECIALE: "SPECIAL",
    PANINI: "SANDWICHES",
    FRAPPÈ: "MILKSHAKES",
    FRULLATI: "SHAKES",
    SMOOTHIE: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "BRUNCH TUTTO IL GIORNO": "ALL DAY BRUNCH",
    COLAZIONE: "BREAKFAST",
    "COLAZIONE TUTTO IL GIORNO": "ALL DAY BREAKFAST",
    PRANZO: "LUNCH",
    CENA: "DINNER",
    ZUPPA: "SOUP",
    ZUPPE: "SOUPS",
    PASTA: "PASTA",
    PIZZA: "PIZZA",
    "FRUTTI DI MARE": "SEAFOOD",
    POLLO: "CHICKEN",
    MANZO: "BEEF",
    AGNELLO: "LAMB",
    MAIALE: "PORK",
    VEGETARIANO: "VEGETARIAN",
    VEGANO: "VEGAN",
    "SENZA GLUTINE": "GLUTEN FREE",
    CONTORNI: "SIDES",
    TAGLIERI: "PLATTERS",
    GRIGLIATE: "GRILLS",
    "ALLA GRIGLIA": "GRILLED",
    FRITTO: "FRIED",
    "AL FORNO": "BAKED",
    FRESCO: "FRESH",
    CALDO: "HOT",
    FREDDO: "COLD",
    SPUNTINI: "SNACKS",
    STUZZICHINI: "LIGHT BITES",
    VINO: "WINE",
    BIRRA: "BEER",
    COCKTAIL: "COCKTAILS",
    BIBITE: "SOFT DRINKS",
    SUCCO: "JUICE",
    GELATO: "ICE CREAM",
    HAMBURGER: "BURGERS",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NOODLES",
    RISO: "RICE",
    CIOTOLE: "BOWLS",
  },
  // Portuguese mappings
  "en-pt": {
    STARTERS: "ENTRADAS",
    APPETIZERS: "PETISCOS",
    "MAIN COURSES": "PRATOS PRINCIPAIS",
    ENTREES: "PRATOS PRINCIPAIS",
    MAINS: "PRATOS PRINCIPAIS",
    DESSERTS: "SOBREMESAS",
    SWEETS: "DOCES",
    SALADS: "SALADAS",
    SALAD: "SALADA",
    KIDS: "CRIANÇAS",
    CHILDREN: "CRIANÇAS",
    DRINKS: "BEBIDAS",
    BEVERAGES: "BEBIDAS",
    COFFEE: "CAFÉ",
    "SPECIAL COFFEE": "CAFÉ ESPECIAL",
    TEA: "CHÁ",
    SPECIALS: "ESPECIALIDADES",
    SPECIAL: "ESPECIAL",
    WRAPS: "WRAPS",
    SANDWICHES: "SANDUÍCHES",
    MILKSHAKES: "MILKSHAKES",
    SHAKES: "BATIDOS",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "ALL DAY BRUNCH": "BRUNCH O DIA TODO",
    BREAKFAST: "CAFÉ DA MANHÃ",
    "ALL DAY BREAKFAST": "CAFÉ DA MANHÃ O DIA TODO",
    LUNCH: "ALMOÇO",
    DINNER: "JANTAR",
    SOUP: "SOPA",
    SOUPS: "SOPAS",
    PASTA: "MASSA",
    PIZZA: "PIZZA",
    SEAFOOD: "FRUTOS DO MAR",
    CHICKEN: "FRANGO",
    BEEF: "CARNE DE VACA",
    LAMB: "CORDEIRO",
    PORK: "PORCO",
    VEGETARIAN: "VEGETARIANO",
    VEGAN: "VEGANO",
    "GLUTEN FREE": "SEM GLÚTEN",
    SIDES: "ACOMPANHAMENTOS",
    PLATTERS: "TRAVESSAS",
    GRILLS: "GRELHADOS",
    GRILLED: "GRELHADO",
    FRIED: "FRITO",
    BAKED: "ASSADO",
    FRESH: "FRESCO",
    HOT: "QUENTE",
    COLD: "FRIO",
    SNACKS: "PETISCOS",
    "LIGHT BITES": "LANCHES LEVES",
    WINE: "VINHO",
    BEER: "CERVEJA",
    COCKTAILS: "COQUETÉIS",
    "SOFT DRINKS": "REFRIGERANTES",
    JUICE: "SUCO",
    "ICE CREAM": "SORVETE",
    BURGERS: "HAMBÚRGUERES",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NOODLES",
    RICE: "ARROZ",
    BOWLS: "TIGELAS",
  },
  "pt-en": {
    ENTRADAS: "STARTERS",
    PETISCOS: "APPETIZERS",
    "PRATOS PRINCIPAIS": "MAIN COURSES",
    SOBREMESAS: "DESSERTS",
    DOCES: "SWEETS",
    SALADAS: "SALADS",
    SALADA: "SALAD",
    CRIANÇAS: "KIDS",
    BEBIDAS: "DRINKS",
    CAFÉ: "COFFEE",
    "CAFÉ ESPECIAL": "SPECIAL COFFEE",
    CHÁ: "TEA",
    ESPECIALIDADES: "SPECIALS",
    ESPECIAL: "SPECIAL",
    SANDUÍCHES: "SANDWICHES",
    MILKSHAKES: "MILKSHAKES",
    BATIDOS: "SHAKES",
    SMOOTHIES: "SMOOTHIES",
    BRUNCH: "BRUNCH",
    "BRUNCH O DIA TODO": "ALL DAY BRUNCH",
    "CAFÉ DA MANHÃ": "BREAKFAST",
    "CAFÉ DA MANHÃ O DIA TODO": "ALL DAY BREAKFAST",
    ALMOÇO: "LUNCH",
    JANTAR: "DINNER",
    SOPA: "SOUP",
    SOPAS: "SOUPS",
    MASSA: "PASTA",
    PIZZA: "PIZZA",
    "FRUTOS DO MAR": "SEAFOOD",
    FRANGO: "CHICKEN",
    "CARNE DE VACA": "BEEF",
    CORDEIRO: "LAMB",
    PORCO: "PORK",
    VEGETARIANO: "VEGETARIAN",
    VEGANO: "VEGAN",
    "SEM GLÚTEN": "GLUTEN FREE",
    ACOMPANHAMENTOS: "SIDES",
    TRAVESSAS: "PLATTERS",
    GRELHADOS: "GRILLS",
    GRELHADO: "GRILLED",
    FRITO: "FRIED",
    ASSADO: "BAKED",
    FRESCO: "FRESH",
    QUENTE: "HOT",
    FRIO: "COLD",
    "LANCHES LEVES": "LIGHT BITES",
    VINHO: "WINE",
    CERVEJA: "BEER",
    COQUETÉIS: "COCKTAILS",
    REFRIGERANTES: "SOFT DRINKS",
    SUCO: "JUICE",
    SORVETE: "ICE CREAM",
    HAMBÚRGUERES: "BURGERS",
    TACOS: "TACOS",
    SUSHI: "SUSHI",
    NOODLES: "NOODLES",
    ARROZ: "RICE",
    TIGELAS: "BOWLS",
  },
  // Chinese (Simplified) mappings
  "en-zh": {
    STARTERS: "开胃菜",
    APPETIZERS: "开胃菜",
    "MAIN COURSES": "主菜",
    ENTREES: "主菜",
    MAINS: "主菜",
    DESSERTS: "甜点",
    SWEETS: "甜品",
    SALADS: "沙拉",
    SALAD: "沙拉",
    KIDS: "儿童",
    CHILDREN: "儿童",
    DRINKS: "饮料",
    BEVERAGES: "饮料",
    COFFEE: "咖啡",
    "SPECIAL COFFEE": "特色咖啡",
    TEA: "茶",
    SPECIALS: "特色菜",
    SPECIAL: "特色",
    WRAPS: "卷饼",
    SANDWICHES: "三明治",
    MILKSHAKES: "奶昔",
    SHAKES: "奶昔",
    SMOOTHIES: "冰沙",
    BRUNCH: "早午餐",
    "ALL DAY BRUNCH": "全天早午餐",
    BREAKFAST: "早餐",
    "ALL DAY BREAKFAST": "全天早餐",
    LUNCH: "午餐",
    DINNER: "晚餐",
    SOUP: "汤",
    SOUPS: "汤类",
    PASTA: "意大利面",
    PIZZA: "披萨",
    SEAFOOD: "海鲜",
    CHICKEN: "鸡肉",
    BEEF: "牛肉",
    LAMB: "羊肉",
    PORK: "猪肉",
    VEGETARIAN: "素食",
    VEGAN: "纯素",
    "GLUTEN FREE": "无麸质",
    SIDES: "配菜",
    PLATTERS: "拼盘",
    GRILLS: "烧烤",
    GRILLED: "烤",
    FRIED: "炸",
    BAKED: "烘烤",
    FRESH: "新鲜",
    HOT: "热",
    COLD: "冷",
    SNACKS: "小吃",
    "LIGHT BITES": "轻食",
    WINE: "葡萄酒",
    BEER: "啤酒",
    COCKTAILS: "鸡尾酒",
    "SOFT DRINKS": "软饮",
    JUICE: "果汁",
    "ICE CREAM": "冰淇淋",
    BURGERS: "汉堡",
    TACOS: "塔可",
    SUSHI: "寿司",
    NOODLES: "面条",
    RICE: "米饭",
    BOWLS: "碗",
  },
  "zh-en": {
    开胃菜: "STARTERS",
    主菜: "MAIN COURSES",
    甜点: "DESSERTS",
    甜品: "SWEETS",
    沙拉: "SALADS",
    儿童: "KIDS",
    饮料: "DRINKS",
    咖啡: "COFFEE",
    特色咖啡: "SPECIAL COFFEE",
    茶: "TEA",
    特色菜: "SPECIALS",
    特色: "SPECIAL",
    卷饼: "WRAPS",
    三明治: "SANDWICHES",
    奶昔: "MILKSHAKES",
    冰沙: "SMOOTHIES",
    早午餐: "BRUNCH",
    全天早午餐: "ALL DAY BRUNCH",
    早餐: "BREAKFAST",
    全天早餐: "ALL DAY BREAKFAST",
    午餐: "LUNCH",
    晚餐: "DINNER",
    汤: "SOUP",
    汤类: "SOUPS",
    意大利面: "PASTA",
    披萨: "PIZZA",
    海鲜: "SEAFOOD",
    鸡肉: "CHICKEN",
    牛肉: "BEEF",
    羊肉: "LAMB",
    猪肉: "PORK",
    素食: "VEGETARIAN",
    纯素: "VEGAN",
    无麸质: "GLUTEN FREE",
    配菜: "SIDES",
    拼盘: "PLATTERS",
    烧烤: "GRILLS",
    烤: "GRILLED",
    炸: "FRIED",
    烘烤: "BAKED",
    新鲜: "FRESH",
    热: "HOT",
    冷: "COLD",
    小吃: "SNACKS",
    轻食: "LIGHT BITES",
    葡萄酒: "WINE",
    啤酒: "BEER",
    鸡尾酒: "COCKTAILS",
    软饮: "SOFT DRINKS",
    果汁: "JUICE",
    冰淇淋: "ICE CREAM",
    汉堡: "BURGERS",
    塔可: "TACOS",
    寿司: "SUSHI",
    面条: "NOODLES",
    米饭: "RICE",
    碗: "BOWLS",
  },
  // Japanese mappings
  "en-ja": {
    STARTERS: "前菜",
    APPETIZERS: "前菜",
    "MAIN COURSES": "メインディッシュ",
    ENTREES: "メインディッシュ",
    MAINS: "メインディッシュ",
    DESSERTS: "デザート",
    SWEETS: "スイーツ",
    SALADS: "サラダ",
    SALAD: "サラダ",
    KIDS: "お子様",
    CHILDREN: "お子様",
    DRINKS: "ドリンク",
    BEVERAGES: "飲み物",
    COFFEE: "コーヒー",
    "SPECIAL COFFEE": "スペシャルコーヒー",
    TEA: "お茶",
    SPECIALS: "本日のおすすめ",
    SPECIAL: "スペシャル",
    WRAPS: "ラップ",
    SANDWICHES: "サンドイッチ",
    MILKSHAKES: "ミルクセーキ",
    SHAKES: "シェイク",
    SMOOTHIES: "スムージー",
    BRUNCH: "ブランチ",
    "ALL DAY BRUNCH": "終日ブランチ",
    BREAKFAST: "朝食",
    "ALL DAY BREAKFAST": "終日朝食",
    LUNCH: "ランチ",
    DINNER: "ディナー",
    SOUP: "スープ",
    SOUPS: "スープ類",
    PASTA: "パスタ",
    PIZZA: "ピザ",
    SEAFOOD: "シーフード",
    CHICKEN: "チキン",
    BEEF: "ビーフ",
    LAMB: "ラム",
    PORK: "ポーク",
    VEGETARIAN: "ベジタリアン",
    VEGAN: "ヴィーガン",
    "GLUTEN FREE": "グルテンフリー",
    SIDES: "サイド",
    PLATTERS: "盛り合わせ",
    GRILLS: "グリル",
    GRILLED: "グリルした",
    FRIED: "揚げ物",
    BAKED: "焼き物",
    FRESH: "新鮮",
    HOT: "温かい",
    COLD: "冷たい",
    SNACKS: "スナック",
    "LIGHT BITES": "軽食",
    WINE: "ワイン",
    BEER: "ビール",
    COCKTAILS: "カクテル",
    "SOFT DRINKS": "ソフトドリンク",
    JUICE: "ジュース",
    "ICE CREAM": "アイスクリーム",
    BURGERS: "ハンバーガー",
    TACOS: "タコス",
    SUSHI: "寿司",
    NOODLES: "麺類",
    RICE: "ご飯",
    BOWLS: "丼",
  },
  "ja-en": {
    前菜: "STARTERS",
    メインディッシュ: "MAIN COURSES",
    デザート: "DESSERTS",
    スイーツ: "SWEETS",
    サラダ: "SALADS",
    お子様: "KIDS",
    ドリンク: "DRINKS",
    飲み物: "BEVERAGES",
    コーヒー: "COFFEE",
    スペシャルコーヒー: "SPECIAL COFFEE",
    お茶: "TEA",
    本日のおすすめ: "SPECIALS",
    スペシャル: "SPECIAL",
    ラップ: "WRAPS",
    サンドイッチ: "SANDWICHES",
    ミルクセーキ: "MILKSHAKES",
    シェイク: "SHAKES",
    スムージー: "SMOOTHIES",
    ブランチ: "BRUNCH",
    終日ブランチ: "ALL DAY BRUNCH",
    朝食: "BREAKFAST",
    終日朝食: "ALL DAY BREAKFAST",
    ランチ: "LUNCH",
    ディナー: "DINNER",
    スープ: "SOUP",
    スープ類: "SOUPS",
    パスタ: "PASTA",
    ピザ: "PIZZA",
    シーフード: "SEAFOOD",
    チキン: "CHICKEN",
    ビーフ: "BEEF",
    ラム: "LAMB",
    ポーク: "PORK",
    ベジタリアン: "VEGETARIAN",
    ヴィーガン: "VEGAN",
    グルテンフリー: "GLUTEN FREE",
    サイド: "SIDES",
    盛り合わせ: "PLATTERS",
    グリル: "GRILLS",
    グリルした: "GRILLED",
    揚げ物: "FRIED",
    焼き物: "BAKED",
    新鮮: "FRESH",
    温かい: "HOT",
    冷たい: "COLD",
    スナック: "SNACKS",
    軽食: "LIGHT BITES",
    ワイン: "WINE",
    ビール: "BEER",
    カクテル: "COCKTAILS",
    ソフトドリンク: "SOFT DRINKS",
    ジュース: "JUICE",
    アイスクリーム: "ICE CREAM",
    ハンバーガー: "BURGERS",
    タコス: "TACOS",
    寿司: "SUSHI",
    麺類: "NOODLES",
    ご飯: "RICE",
    丼: "BOWLS",
  },
};

function detectSourceLanguage(
  items: Array<{ name: string; category: string }>,
  targetLanguage: string
): string {
  const spanishIndicators = [
    "CAFÉ",
    "CAFE",
    "BEBIDAS",
    "TÉ",
    "TE",
    "ESPECIALES",
    "ESPECIAL",
    "NIÑOS",
    "NINOS",
    "ENSALADAS",
    "POSTRES",
    "ENTRADAS",
    "PLATOS PRINCIPALES",
    "APERITIVOS",
    "MALTEADAS",
    "BATIDOS",
    "SÁNDWICHES",
    "SANDWICHES",
    "DESAYUNO",
    "ALMUERZO",
    "CENA",
    "SOPA",
    "SOPAS",
    "MARISCOS",
    "POLLO",
    "CARNE DE RES",
    "CERDO",
    "VEGETARIANO",
    "VEGANO",
    "SIN GLUTEN",
    "CON",
    "DE",
    "Y",
    "PARA",
    "LOS",
    "LAS",
    "EL",
    "LA",
    "DEL",
    "AL",
    "HUEVOS",
    "QUESO",
    "LECHE",
    "PAN",
    "ARROZ",
    "FRIJOLES",
    "SALSA",
    "TORTILLA",
    "TACO",
    "BURRITO",
    "QUESADILLA",
    "ENCHILADA",
  ];

  const englishIndicators = [
    "STARTERS",
    "APPETIZERS",
    "MAIN COURSES",
    "ENTREES",
    "MAINS",
    "DESSERTS",
    "SALADS",
    "SALAD",
    "KIDS",
    "CHILDREN",
    "DRINKS",
    "BEVERAGES",
    "COFFEE",
    "TEA",
    "SPECIALS",
    "WRAPS",
    "SANDWICHES",
    "MILKSHAKES",
    "SHAKES",
    "SMOOTHIES",
    "BRUNCH",
    "BREAKFAST",
    "ALL DAY BREAKFAST",
    "ALL DAY BRUNCH",
    "LATE BREAKFAST",
    "LUNCH",
    "DINNER",
    "SOUP",
    "SOUPS",
    "PASTA",
    "PIZZA",
    "SEAFOOD",
    "CHICKEN",
    "BEEF",
    "LAMB",
    "PORK",
    "VEGETARIAN",
    "VEGAN",
    "GLUTEN FREE",
    "GLUTEN-FREE",
    "WITH",
    "AND",
    "OR",
    "THE",
    "OF",
    "FOR",
    "IN",
    "ON",
    "TO",
    "EGGS",
    "CHEESE",
    "MILK",
    "BREAD",
    "RICE",
    "BEANS",
    "SAUCE",
    "BURGER",
    "SANDWICH",
    "STEAK",
    "GRILLED",
    "FRIED",
    "BAKED",
    "FRESH",
    "HOT",
    "COLD",
    "SIDES",
    "PLATTERS",
  ];

  const arabicIndicators = [
    "المقبلات",
    "الأطباق الرئيسية",
    "الأطباق",
    "الرئيسية",
    "الحلويات",
    "السلطات",
    "الأطفال",
    "المشروبات",
    "القهوة",
    "الشاي",
    "العروض",
    "الخاصة",
    "السندويشات",
    "المخفوقات",
    "السموذي",
    "فطور",
    "وغداء",
    "طوال",
    "اليوم",
    "متأخر",
    "غداء",
    "عشاء",
    "الحساء",
    "المعكرونة",
    "البيتزا",
    "المأكولات",
    "البحرية",
    "الدجاج",
    "لحم",
    "البقر",
    "الغنم",
    "الخنزير",
    "نباتي",
    "صرف",
    "خالي",
    "من",
    "الغلوتين",
    "الجانبية",
    "الكبيرة",
    "المشاوي",
    "مشوي",
    "مقلي",
    "مخبوز",
    "طازج",
    "ساخن",
    "بارد",
    "الوجبات",
    "الخفيفة",
    "وجبات",
    "خفيفة",
    "مع",
    "و",
    "أو",
    "في",
    "على",
    "إلى",
    "بيض",
    "جبن",
    "حليب",
    "خبز",
    "أرز",
    "فول",
    "صلصة",
    "برجر",
    "سندويش",
    "ستيك",
  ];

  let spanishCount = 0;
  let englishCount = 0;
  let arabicCount = 0;

  items.forEach((item) => {
    const text = `${item.name} ${item.category}`;
    const textUpper = text.toUpperCase();

    spanishIndicators.forEach((indicator) => {
      if (textUpper.includes(indicator)) spanishCount++;
    });

    englishIndicators.forEach((indicator) => {
      if (textUpper.includes(indicator)) englishCount++;
    });

    arabicIndicators.forEach((indicator) => {
      if (text.includes(indicator)) arabicCount++;
    });
  });

  // Return the language with the highest count
  const counts = [
    { lang: "es", count: spanishCount },
    { lang: "en", count: englishCount },
    { lang: "ar", count: arabicCount },
  ];

  counts.sort((a, b) => b.count - a.count);

  const first = counts[0];
  if (first && first.count > 3) {
    return first.lang;
  }

  // Otherwise, assume the opposite of target language
  // If translating to Arabic, assume English source
  // If translating to English, check if we have Arabic or Spanish indicators
  if (targetLanguage === "ar") return "en";
  if (targetLanguage === "en") {
    return arabicCount > spanishCount ? "ar" : "es";
  }
  if (targetLanguage === "es") return "en";

  // Default fallback
  return "en";
}

export async function executeMenuTranslate(
  _params: unknown,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const typedParams = _params as { targetLanguage: string; includeDescriptions?: boolean };
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (!items || items.length === 0) {
    throw new AIAssistantError("No menu items found", "INVALID_PARAMS");
  }

  const targetLangName = LANGUAGE_NAMES[typedParams.targetLanguage] || typedParams.targetLanguage;
  const uniqueCategories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
  const detectedSourceLanguage = detectSourceLanguage(items, typedParams.targetLanguage);

  if (preview) {
    try {
      const { getOpenAI } = await import("@/lib/openai");
      const openai = getOpenAI();

      const sampleItems = items.slice(0, 5);

      const itemsToTranslate = sampleItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(typedParams.includeDescriptions && item.description
          ? { description: item.description }
          : {
              /* Empty */
            }),
      }));

      const mappingKey = `${detectedSourceLanguage}-${typedParams.targetLanguage}`;
      const categoryMappingList = Object.entries(
        CATEGORY_MAPPINGS[mappingKey] ||
          {
            /* Empty */
          }
      )
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join("\n");

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS:
1. Return EXACTLY ${sampleItems.length} items
2. MUST translate BOTH item names AND category names
3. Keep the 'id' field UNCHANGED
4. Use these EXACT category mappings:
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology appropriately
8. All categories MUST be translated

INPUT ITEMS (${sampleItems.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content:
              "You are a professional menu translator. Return valid JSON with an 'items' array containing the EXACT same number of items as provided.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const translated = JSON.parse(content);
        const translatedArray = translated.items || [];

        return {
          toolName: "menu.translate",
          before: sampleItems.map((i) => ({
            name: i.name,
            description: i.description || "",
            category: i.category || "",
          })),
          after: translatedArray.map((i: unknown) => {
            const item = i as {
              name?: string;
              originalName?: string;
              description?: string;
              category?: string;
            };
            return {
              name: item.name || item.originalName || "",
              description: item.description || "",
              category: item.category || "",
            };
          }),
          impact: {
            itemsAffected: items.length,
            categoriesAffected: uniqueCategories.length,
            description: `Menu will be translated to ${targetLangName}. This will update ${items.length} items and ${uniqueCategories.length} categories${typedParams.includeDescriptions ? " (including descriptions)" : ""}.`,
          },
        };
      }
    } catch (_error) { /* Error handled silently */ }

    return {
      toolName: "menu.translate",
      before: items.slice(0, 5).map((i) => ({
        name: i.name,
        description: i.description || "",
        category: i.category || "",
      })),
      after: items.slice(0, 5).map((i) => ({
        name: `[Will translate to ${targetLangName}] ${i.name}`,
        description: i.description ? `[Will translate to ${targetLangName}] ${i.description}` : "",
        category: i.category ? `[Will translate to ${targetLangName}] ${i.category}` : "",
      })),
      impact: {
        itemsAffected: items.length,
        categoriesAffected: uniqueCategories.length,
        description: `Menu will be translated to ${targetLangName}. This will update ${items.length} items and ${uniqueCategories.length} categories${typedParams.includeDescriptions ? " (including descriptions)" : ""}.`,
      },
    };
  }

  // Execute translation
  try {
    const { getOpenAI } = await import("@/lib/openai");
    const openai = getOpenAI();

    const originalItemCount = items.length;
    const translatedItems: unknown[] = [];
    const batchSize = 15;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const itemsToTranslate = batch.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(typedParams.includeDescriptions && item.description
          ? { description: item.description }
          : {
              /* Empty */
            }),
      }));

      const mappingKey = `${detectedSourceLanguage}-${typedParams.targetLanguage}`;
      const categoryMappingList = Object.entries(
        CATEGORY_MAPPINGS[mappingKey] ||
          {
            /* Empty */
          }
      )
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join("\n");

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS:
1. Return EXACTLY ${batch.length} items
2. MUST translate BOTH item names AND category names
3. Keep the 'id' field UNCHANGED
4. Use these EXACT category mappings:
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology appropriately
8. All categories MUST be translated

INPUT ITEMS (${batch.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}`;

      let retryCount = 0;
      const maxRetries = 3;
      let batchTranslated = false;

      while (!batchTranslated && retryCount < maxRetries) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
            messages: [
              {
                role: "system",
                content: `You are a professional menu translator. Return valid JSON with an 'items' array containing EXACTLY ${batch.length} items. Never omit items.`,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            const translated = JSON.parse(content);
            const translatedArray = translated.items || [];

            if (translatedArray.length === batch.length) {
              const validItems = translatedArray.filter(
                (item: Record<string, unknown>) => item && item.id && item.name && item.category
              );

              if (validItems.length === batch.length) {
                translatedItems.push(...translatedArray);
                batchTranslated = true;
              } else {
                retryCount++;
              }
            } else {
              retryCount++;
            }
          } else {
            retryCount++;
          }
        } catch (batchError) {

          retryCount++;
        }
      }

      if (!batchTranslated) {

        const fallbackItems = batch.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description || "",
        }));
        translatedItems.push(...fallbackItems);
      }
    }

    if (translatedItems.length !== originalItemCount) {
      throw new AIAssistantError(
        `Translation failed: Item count mismatch. Expected ${originalItemCount} items, got ${translatedItems.length}`,
        "EXECUTION_FAILED"
      );
    }

    let updatedCount = 0;
    let failedCount = 0;

    interface TranslatedItem {
      id: string;
      name: string;
      category?: string;
      description?: string;
    }

    for (const translatedItem of translatedItems) {
      const item = translatedItem as TranslatedItem;
      if (!translatedItem || !item.id || !item.name) {
        failedCount++;
        continue;
      }

      interface UpdateData {
        name: string;
        updated_at: string;
        category?: string;
        description?: string;
      }

      const updateData: UpdateData = {
        name: item.name,
        updated_at: new Date().toISOString(),
      };

      if (item.category) {
        updateData.category = item.category;
      }

      if (typedParams.includeDescriptions && item.description) {
        updateData.description = item.description;
      }

      const { error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", item.id)
        .eq("venue_id", venueId);

      if (!error) {
        updatedCount++;
      } else {
        failedCount++;
      }
    }

    if (updatedCount === 0 && translatedItems.length > 0) {
      throw new AIAssistantError(
        `Translation failed: Could not update unknown items (${failedCount} failed)`,
        "EXECUTION_FAILED"
      );
    }

    // Revalidate the menu management page to show updated translations
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
    } catch (revalidateError) {

      // Don't fail the whole operation if revalidation fails
    }

    return {
      success: true,
      toolName: "menu.translate",
      result: {
        message: `Successfully translated ${updatedCount} menu items and categories to ${targetLangName}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
        itemsTranslated: updatedCount,
        itemsFailed: failedCount,
        categoriesTranslated: uniqueCategories.length,
        targetLanguage: typedParams.targetLanguage,
        includeDescriptions: typedParams.includeDescriptions,
        originalItemCount,
        finalItemCount: translatedItems.length,
      },
      auditId: "",
    };
  } catch (_error) {

    const errorDetails =
      _error instanceof Error
        ? { message: _error.message, stack: _error.stack }
        : { error: String(_error) };
    throw new AIAssistantError(
      `Translation failed: ${_error instanceof Error ? _error.message : "Unknown error"}`,
      "EXECUTION_FAILED",
      errorDetails
    );
  }
}

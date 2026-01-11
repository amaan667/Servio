import { createClient } from "@/lib/supabase";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";

const LANGUAGE_NAMES: Record<string, string> = {

};

const CATEGORY_MAPPINGS: Record<string, Record<string, string>> = {
  "en-es": {

    "MAIN COURSES": "PLATOS PRINCIPALES",

    "SPECIAL COFFEE": "CAFÉ ESPECIAL",

    "GLUTEN FREE": "SIN GLUTEN",
  },
  "es-en": {

    "PLATOS PRINCIPALES": "MAIN COURSES",

    NIÑOS: "KIDS",

    CAFÉ: "COFFEE",

    "CAFÉ ESPECIAL": "SPECIAL COFFEE",
    "CAFE ESPECIAL": "SPECIAL COFFEE",
    TÉ: "TEA",

    SÁNDWICHES: "SANDWICHES",

    "CARNE DE RES": "BEEF",

    "SIN GLUTEN": "GLUTEN FREE",
  },
  "en-ar": {

    "MAIN COURSES": "الأطباق الرئيسية",

    "SPECIAL COFFEE": "القهوة الخاصة",

    "ALL DAY BRUNCH": "فطور وغداء طوال اليوم",

    "ALL DAY BREAKFAST": "فطور طوال اليوم",
    "LATE BREAKFAST": "فطور متأخر",
    "LATE BREAKFAST ALL DAY": "فطور متأخر طوال اليوم",

    "GLUTEN FREE": "خالي من الغلوتين",

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

    "MAIN COURSES": "PLATS PRINCIPAUX",

    "SPECIAL COFFEE": "CAFÉ SPÉCIAL",

    "ALL DAY BRUNCH": "BRUNCH TOUTE LA JOURNÉE",

    "ALL DAY BREAKFAST": "PETIT DÉJEUNER TOUTE LA JOURNÉE",

    "GLUTEN FREE": "SANS GLUTEN",

    "LIGHT BITES": "PETITES BOUCHÉES",

    "SOFT DRINKS": "BOISSONS SANS ALCOOL",

    "ICE CREAM": "GLACE",

  },
  "fr-en": {
    ENTRÉES: "STARTERS",
    "PLATS PRINCIPAUX": "MAIN COURSES",

    CAFÉ: "COFFEE",
    "CAFÉ SPÉCIAL": "SPECIAL COFFEE",
    THÉ: "TEA",
    SPÉCIALITÉS: "SPECIALS",
    SPÉCIAL: "SPECIAL",
    "MILK-SHAKES": "MILKSHAKES",

    "BRUNCH TOUTE LA JOURNÉE": "ALL DAY BRUNCH",
    "PETIT DÉJEUNER": "BREAKFAST",
    "PETIT DÉJEUNER TOUTE LA JOURNÉE": "ALL DAY BREAKFAST",
    DÉJEUNER: "LUNCH",
    DÎNER: "DINNER",

    PÂTES: "PASTA",

    "FRUITS DE MER": "SEAFOOD",

    BŒUF: "BEEF",

    VÉGÉTARIEN: "VEGETARIAN",
    VÉGÉTALIEN: "VEGAN",
    "SANS GLUTEN": "GLUTEN FREE",

    GRILLÉ: "GRILLED",

    "CUIT AU FOUR": "BAKED",

    "PETITES BOUCHÉES": "LIGHT BITES",

    BIÈRE: "BEER",

    "BOISSONS SANS ALCOOL": "SOFT DRINKS",

  },
  // German mappings
  "en-de": {

    "MAIN COURSES": "HAUPTGERICHTE",

    "SPECIAL COFFEE": "SPEZIAL KAFFEE",

    "ALL DAY BRUNCH": "GANZTÄGIGER BRUNCH",

    "ALL DAY BREAKFAST": "GANZTÄGIGES FRÜHSTÜCK",

    "GLUTEN FREE": "GLUTENFREI",

    "LIGHT BITES": "KLEINE GERICHTE",

    "SOFT DRINKS": "ALKOHOLFREIE GETRÄNKE",

    "ICE CREAM": "EIS",

  },
  "de-en": {

    SÜSSIGKEITEN: "SWEETS",

    GETRÄNKE: "DRINKS",

    "SPEZIAL KAFFEE": "SPECIAL COFFEE",

    SPEZIALITÄTEN: "SPECIALS",

    "GANZTÄGIGER BRUNCH": "ALL DAY BRUNCH",
    FRÜHSTÜCK: "BREAKFAST",
    "GANZTÄGIGES FRÜHSTÜCK": "ALL DAY BREAKFAST",

    MEERESFRÜCHTE: "SEAFOOD",
    HÄHNCHEN: "CHICKEN",

    "KLEINE GERICHTE": "LIGHT BITES",

    "ALKOHOLFREIE GETRÄNKE": "SOFT DRINKS",

  },
  // Italian mappings
  "en-it": {

    "MAIN COURSES": "PIATTI PRINCIPALI",

    "SPECIAL COFFEE": "CAFFÈ SPECIALE",

    "ALL DAY BRUNCH": "BRUNCH TUTTO IL GIORNO",

    "ALL DAY BREAKFAST": "COLAZIONE TUTTO IL GIORNO",

    "GLUTEN FREE": "SENZA GLUTINE",

    "LIGHT BITES": "STUZZICHINI",

    "SOFT DRINKS": "BIBITE",

    "ICE CREAM": "GELATO",

  },
  "it-en": {

    "PIATTI PRINCIPALI": "MAIN COURSES",

    CAFFÈ: "COFFEE",
    "CAFFÈ SPECIALE": "SPECIAL COFFEE",
    TÈ: "TEA",
    SPECIALITÀ: "SPECIALS",

    FRAPPÈ: "MILKSHAKES",

    "BRUNCH TUTTO IL GIORNO": "ALL DAY BRUNCH",

    "COLAZIONE TUTTO IL GIORNO": "ALL DAY BREAKFAST",

    "FRUTTI DI MARE": "SEAFOOD",

    "SENZA GLUTINE": "GLUTEN FREE",

    "ALLA GRIGLIA": "GRILLED",

    "AL FORNO": "BAKED",

  },
  // Portuguese mappings
  "en-pt": {

    "MAIN COURSES": "PRATOS PRINCIPAIS",

    "SPECIAL COFFEE": "CAFÉ ESPECIAL",

    "ALL DAY BRUNCH": "BRUNCH O DIA TODO",

    "ALL DAY BREAKFAST": "CAFÉ DA MANHÃ O DIA TODO",

    "GLUTEN FREE": "SEM GLÚTEN",

    "LIGHT BITES": "LANCHES LEVES",

    "SOFT DRINKS": "REFRIGERANTES",

    "ICE CREAM": "SORVETE",

  },
  "pt-en": {

    "PRATOS PRINCIPAIS": "MAIN COURSES",

    CRIANÇAS: "KIDS",

    CAFÉ: "COFFEE",
    "CAFÉ ESPECIAL": "SPECIAL COFFEE",
    CHÁ: "TEA",

    SANDUÍCHES: "SANDWICHES",

    "BRUNCH O DIA TODO": "ALL DAY BRUNCH",
    "CAFÉ DA MANHÃ": "BREAKFAST",
    "CAFÉ DA MANHÃ O DIA TODO": "ALL DAY BREAKFAST",
    ALMOÇO: "LUNCH",

    "FRUTOS DO MAR": "SEAFOOD",

    "CARNE DE VACA": "BEEF",

    "SEM GLÚTEN": "GLUTEN FREE",

    "LANCHES LEVES": "LIGHT BITES",

    COQUETÉIS: "COCKTAILS",

    HAMBÚRGUERES: "BURGERS",

  },
  // Chinese (Simplified) mappings
  "en-zh": {

    "MAIN COURSES": "主菜",

    "SPECIAL COFFEE": "特色咖啡",

    "ALL DAY BRUNCH": "全天早午餐",

    "ALL DAY BREAKFAST": "全天早餐",

    "GLUTEN FREE": "无麸质",

    "LIGHT BITES": "轻食",

    "SOFT DRINKS": "软饮",

    "ICE CREAM": "冰淇淋",

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

    "MAIN COURSES": "メインディッシュ",

    "SPECIAL COFFEE": "スペシャルコーヒー",

    "ALL DAY BRUNCH": "終日ブランチ",

    "ALL DAY BREAKFAST": "終日朝食",

    "GLUTEN FREE": "グルテンフリー",

    "LIGHT BITES": "軽食",

    "SOFT DRINKS": "ソフトドリンク",

    "ICE CREAM": "アイスクリーム",

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

    englishIndicators.forEach((indicator) => {
      if (textUpper.includes(indicator)) englishCount++;

    arabicIndicators.forEach((indicator) => {
      if (text.includes(indicator)) arabicCount++;

  // Return the language with the highest count
  const counts = [
    { lang: "es", count: spanishCount },
    { lang: "en", count: englishCount },
    { lang: "ar", count: arabicCount },
  ];

  counts.sort((a, b) => b.count - a.count);

  // If we have a clear winner (more than 3 matches), use it
  if (counts[0].count > 3) {
    return counts[0].lang;
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

        ...(typedParams.includeDescriptions && item.description
          ? { description: item.description }

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

          },
          {

          },
        ],

        response_format: { type: "json_object" },

      const content = response.choices[0]?.message?.content;
      if (content) {
        const translated = JSON.parse(content);
        const translatedArray = translated.items || [];

        return {

          })),

            };
            return {

            };
          }),

            description: `Menu will be translated to ${targetLangName}. This will update ${items.length} items and ${uniqueCategories.length} categories${typedParams.includeDescriptions ? " (including descriptions)" : ""}.`,
          },
        };
      }
    } catch (_error) {
      
    }

    return {

      before: items.slice(0, 5).map((i) => ({

      })),
      after: items.slice(0, 5).map((i) => ({
        name: `[Will translate to ${targetLangName}] ${i.name}`,
        description: i.description ? `[Will translate to ${targetLangName}] ${i.description}` : "",
        category: i.category ? `[Will translate to ${targetLangName}] ${i.category}` : "",
      })),

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
       + 1}/${Math.ceil(items.length / batchSize)}`
      );

      const itemsToTranslate = batch.map((item) => ({

        ...(typedParams.includeDescriptions && item.description
          ? { description: item.description }

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

                content: `You are a professional menu translator. Return valid JSON with an 'items' array containing EXACTLY ${batch.length} items. Never omit items.`,
              },
              {

              },
            ],

            response_format: { type: "json_object" },

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
           + 1} translation error:`,
            batchError
          );
          retryCount++;
        }
      }

      if (!batchTranslated) {
         + 1} failed after ${maxRetries} retries`
        );
        const fallbackItems = batch.map((item) => ({

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

    }

    for (const translatedItem of translatedItems) {
      const item = translatedItem as TranslatedItem;
      if (!translatedItem || !item.id || !item.name) {
        failedCount++;
        continue;
      }

      interface UpdateData {

      }

      const updateData: UpdateData = {

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

        message: `Successfully translated ${updatedCount} menu items and categories to ${targetLangName}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,

        originalItemCount,

      },

    };
  } catch (_error) {
     }
    );
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

const currencyRegex = /[£€$]|\bGBP\b|\bEUR\b|\bUSD\b/i;
const priceRegex = /(?:£|€|\$)?\s?\d{1,3}(?:[\.,:]\d{2})/;
const rangeRegex = /\d+(?:\.\d{2})?\s?-\s?\d+(?:\.\d{2})?/;
const keywords =
  /(coffee|espresso|latte|cappuccino|tea|sandwich|burger|pizza|fries|salad|wrap|panini|cake|juice|smoothie|beer|wine|cocktail|mocktail)/i;

export function isMenuLike(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 200) return false;
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const signals: boolean[] = [];
  signals.push(currencyRegex.test(trimmed) || priceRegex.test(trimmed));
  signals.push(rangeRegex.test(trimmed));
  signals.push(keywords.test(trimmed));
  const listLike = lines.filter((l) => l.length >= 3 && l.length <= 80).length >= 8;
  signals.push(listLike);
  return signals.filter(Boolean).length >= 2;
}

export default isMenuLike;

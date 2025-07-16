import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";

interface ExtractedMenuItem {
  name: string;
  price: number;
  category?: string;
  description?: string;
}

function parseMenuLines(lines: string[]): ExtractedMenuItem[] {
  let currentCategory = "";
  const items: ExtractedMenuItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    // Category detection: all caps, short, or ends with ':'
    if ((line === line.toUpperCase() && line.length > 2 && line.length < 30) || /:$/.test(line)) {
      currentCategory = line.replace(/:$/, "").trim();
      continue;
    }
    // Regex: Name ... £Price or Name ... Price
    const match = line.match(/^(.*?)\s*[.\-–—]*\s*£?(\d+\.\d{2})\s*$/);
    if (match) {
      // Look for description in previous line (if not a category or price)
      let name = match[1].replace(/^\d+\.?\s*/, "").trim();
      let price = parseFloat(match[2]);
      let description = "";
      if (i > 0) {
        const prev = lines[i - 1].trim();
        // Not a category, not a price line
        if (!((prev === prev.toUpperCase() && prev.length > 2 && prev.length < 30) || /:$/.test(prev)) && !prev.match(/£?\d+\.\d{2}/)) {
          description = prev;
        }
      }
      // If name is empty, try previous line
      if (!name && i > 0) {
        name = lines[i - 1].trim();
      }
      if (name && price > 0) {
        const key = (name + price + currentCategory).toLowerCase();
        if (!seen.has(key)) {
          items.push({ name, price, category: currentCategory || undefined, description: description || undefined });
          seen.add(key);
        }
      }
    }
  }
  return items;
}

async function extractMenuWithGPT(text: string): Promise<ExtractedMenuItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const openai = new OpenAI({ apiKey });
  const prompt = `Extract all menu items from the following restaurant menu text. For each item, return a JSON object with fields: name, price (number), category (if available), and description (if available). Return a JSON array.\n\nMenu text:\n${text}\n\nJSON:`;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant that extracts structured menu data from unstructured text." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  });
  const content = response.choices[0]?.message?.content || "";
  try {
    const jsonStart = content.indexOf("[");
    const jsonEnd = content.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const json = content.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(json);
    }
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to parse GPT menu extraction response");
  }
}

// Extract from HTML using Cheerio
async function extractFromHtml(url: string) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  let lines: string[] = [];
  $("li, .menu-item, .item, .dish, .product, tr").each((_: unknown, el: any) => {
    const text = $(el).text().trim();
    if (text.length > 2) lines.push(text);
  });
  // Also try all text nodes as fallback
  if (lines.length < 5) {
    lines = $("body").text().split("\n").map((l) => l.trim()).filter(Boolean);
  }
  const text = lines.join("\n");
  try {
    return await extractMenuWithGPT(text);
  } catch (err) {
    return parseMenuLines(lines);
  }
}

// Main function
async function extractMenu(url: string): Promise<ExtractedMenuItem[]> {
  try {
    const htmlItems = await extractFromHtml(url);
    if (htmlItems.length > 0) return htmlItems;
    throw new Error("No menu items found");
  } catch (err) {
    throw new Error(`Failed to extract menu from URL: ${err}`);
  }
}

// CLI usage
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: pnpm tsx scripts/extract-menu.ts <url>");
    process.exit(1);
  }
  extractMenu(url)
    .then((items: ExtractedMenuItem[]) => {
      console.log("Extracted menu items:");
      items.forEach((item: ExtractedMenuItem) => console.log(item));
    })
    .catch((err: unknown) => {
      console.error("Failed to extract menu:", err);
    });
}

export { extractMenu };
export type { ExtractedMenuItem }; 
import OpenAI from "openai";
import * as cheerio from "cheerio";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function extractTextWithOcrSpace(file: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) throw new Error("Missing OCR_SPACE_API_KEY");

  const formData = new FormData();
  formData.append("file", new Blob([file]), "menu." + (mimetype.split("/")[1] || "pdf"));
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: apiKey,
    },
    body: formData as any,
  });

  const result = await res.json();
  if (!result || !result.ParsedResults || !result.ParsedResults[0]) {
    throw new Error("OCR.space failed to extract text.");
  }
  return result.ParsedResults[0].ParsedText || "";
}

async function extractMenuWithGPT(text: string): Promise<any[]> {
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

async function extractTextFromHtmlUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  let lines: string[] = [];
  $("li, .menu-item, .item, .dish, .product, tr").each((_: unknown, el: any) => {
    const text = $(el).text().trim();
    if (text.length > 2) lines.push(text);
  });
  if (lines.length < 5) {
    lines = $("body").text().split("\n").map((l: string) => l.trim()).filter(Boolean);
  }
  return lines.join("\n");
}

async function fetchUrlAsBuffer(url: string): Promise<{ buffer: Buffer, mimetype: string }> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), mimetype: contentType };
}

export async function POST(req: Request) {
  console.log('API: upload-menu-file POST called');
  try {
    if (req.method && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    let base64, mimetype, url;
    try {
      const body = await req.json();
      base64 = body.base64;
      mimetype = body.mimetype;
      url = body.url;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 });
    }

    let text = "";
    if (url) {
      console.log('API: URL provided', url);
      // Determine if URL is PDF or HTML
      if (url.endsWith('.pdf')) {
        // Download PDF and OCR
        const { buffer, mimetype: urlMime } = await fetchUrlAsBuffer(url);
        text = await extractTextWithOcrSpace(buffer, urlMime);
      } else {
        // Try HTML extraction
        text = await extractTextFromHtmlUrl(url);
      }
    } else if (base64 && mimetype) {
      const fileBuffer = Buffer.from(base64, "base64");
      text = await extractTextWithOcrSpace(fileBuffer, mimetype);
    } else {
      return new Response(JSON.stringify({ error: "No file or URL provided." }), { status: 400 });
    }
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Failed to extract text from input." }), { status: 400 });
    }
    const items = await extractMenuWithGPT(text);
    return new Response(JSON.stringify({ items }), { status: 200 });
  } catch (err: any) {
    console.error('API: error', err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to process menu file." }), { status: 500 });
  }
} 
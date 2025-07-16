import OpenAI from "openai";

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

export async function POST(req: Request) {
  console.log('API: upload-menu-file POST called');
  try {
    if (req.method && req.method !== "POST") {
      console.log('API: Not a POST request');
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    const { base64, mimetype } = await req.json();
    if (!base64 || !mimetype) {
      console.log('API: Missing base64 or mimetype');
      return new Response(JSON.stringify({ error: "No file uploaded." }), { status: 400 });
    }
    const fileBuffer = Buffer.from(base64, "base64");
    console.log('API: decoded fileBuffer', fileBuffer.length, mimetype);
    const text = await extractTextWithOcrSpace(fileBuffer, mimetype);
    console.log('API: OCR.space extracted text', text.slice(0, 100));
    if (!text.trim()) {
      console.log('API: No text extracted');
      return new Response(JSON.stringify({ error: "Failed to extract text from file." }), { status: 400 });
    }
    const items = await extractMenuWithGPT(text);
    console.log('API: GPT extracted items', items.length);
    return new Response(JSON.stringify({ items }), { status: 200 });
  } catch (err: any) {
    console.error('API: error', err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to process menu file." }), { status: 500 });
  }
} 
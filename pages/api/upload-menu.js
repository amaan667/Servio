import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";
import * as cheerio from "cheerio";

// Multer config for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});
export const config = { api: { bodyParser: false } };

// Supabase init
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- UTILS --- //
let debugLogs = [];
function log(msg, data) {
  const t = new Date().toISOString();
  const entry = `[MENU_EXTRACTION] ${t}: ${msg} ${data ? JSON.stringify(data).slice(0, 500) : ''}`;
  debugLogs.push(entry);
  console.log(entry);
}
function generateHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
async function getCache(hash) {
  try {
    const { data } = await supabase
      .from("menu_cache")
      .select("result")
      .eq("hash", hash)
      .single();
    return data ? data.result : null;
  } catch {
    return null;
  }
}
async function setCache(hash, result) {
  try {
    await supabase.from("menu_cache").upsert({
      hash,
      result,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    log("Cache save failed:", error.message);
  }
}
async function checkOpenAIQuota() {
  try {
    await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1,
    });
    return true;
  } catch (err) {
    log("OpenAI quota error", err.message);
    return false;
  }
}
async function extractTextFromPDF(buffer) {
  const { text } = await pdf(buffer);
  if (!text || text.length < 20)
    throw new Error("No readable text extracted from PDF");
  return text;
}

// --- EXTRACT TEXT FROM URL --- //
async function extractTextFromUrl(url) {
  log("Downloading page", url);
  const res = await fetch(url);
  log("Fetch status", { status: res.status, headers: Object.fromEntries(res.headers.entries()) });
  if (!res.ok) throw new Error("Failed to fetch the provided URL.");
  const contentType = res.headers.get("content-type");
  log("Content-Type", contentType);
  // If it's a PDF
  if (contentType.includes("pdf")) {
    const buffer = await res.buffer();
    log("PDF buffer length", buffer.length);
    return await extractTextFromPDF(buffer);
  }
  // Otherwise, try HTML
  const html = await res.text();
  log("HTML length", html.length);
  const $ = cheerio.load(html);
  let menuText = "";
  $("section,main,div").each((_, el) => {
    const $el = $(el);
    const txt = $el.text();
    const idClass = ($el.attr("id") || "") + " " + ($el.attr("class") || "");
    if (
      idClass.toLowerCase().includes("menu") ||
      txt.toLowerCase().includes("starters") ||
      txt.toLowerCase().includes("mains") ||
      txt.toLowerCase().includes("breakfast") ||
      txt.length > 300
    ) {
      menuText += txt.trim() + "\n";
    }
  });
  if (!menuText || menuText.length < 100) menuText = $("body").text();
  log("Extracted menuText (first 500 chars)", menuText.slice(0, 500));
  if (!menuText || menuText.length < 50)
    throw new Error("No menu-like content found in page.");
  return menuText;
}

// --- GPT MENU EXTRACTION (text-in) --- //
async function extractMenuItemsFromText(text) {
  const systemPrompt = `You are extracting structured menu data from OCR text.

Your task:
- Identify and extract all menu items.
- For each menu item, provide: 
  - Name
  - Description (if it exists; combine multi-line descriptions)
  - Price (if available)

Special instructions for accuracy:
- **Section descriptions** (for example, text under “Beverages” like “Coca-Cola, Coke Zero, Sprite, Fanta, Irn-Bru”) should be treated as a list of individual menu items, **not as a description for any one item**.
- Only include actual item descriptions if they are directly underneath and clearly refer to one menu item.
- For sections listing multiple drinks, juices, or items (separated by commas or listed as options), **split each as a separate menu item** with their shared price.
- **Do not merge section instructions, allergen notices, or group headers into any item description.**

Example formatting for “Beverages”:
- Each drink (e.g., “Coca-Cola”, “Coke Zero”, “Sprite”, etc.) should be a separate menu item with the price shown, and without a description unless one is specifically provided under that item.

Use this approach for all similar sections in the menu.

Now extract the menu items as a structured table with columns: Name, Description, Price.

Here is the OCR text:
[PASTE MENU TEXT HERE]
`;
  const userPrompt = `Extract all menu items from this menu:\n\n${text}\n\nRemember: ONLY valid JSON array, no markdown.`;
  log("Prompting GPT-4o", { systemPrompt: systemPrompt.slice(0, 300), userPrompt: userPrompt.slice(0, 300) });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });
  const content = response.choices[0].message.content;
  log("GPT-4o raw response (first 500 chars)", content.slice(0, 500));
  const jsonMatch = content.match(/\[.*\]/s);
  if (!jsonMatch) throw new Error("No valid JSON array found in GPT response");
  let items;
  try {
    items = JSON.parse(jsonMatch[0]);
  } catch (err) {
    log("JSON parse error", err.stack || err.message);
    throw new Error("Invalid JSON from GPT");
  }
  // Assign position based on original order
  items = items.map((item, idx) => ({ ...item, position: idx }));
  // Assign category_position based on first appearance
  const categoryOrder = {};
  let catPos = 0;
  items.forEach(item => {
    const cat = item.category || "Uncategorized";
    if (!(cat in categoryOrder)) {
      categoryOrder[cat] = catPos++;
    }
  });
  items = items.map(item => ({ ...item, category_position: categoryOrder[item.category || "Uncategorized"] }));
  return items;
}

// --- DEDUPLICATION --- //
function deduplicateMenuItems(items) {
  const seen = new Set(),
    unique = [];
  for (const item of items) {
    const key = `${item.name?.toLowerCase().replace(/[^a-z0-9]/g, "")}-${item.price}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

// --- MAIN API HANDLER --- //
async function processMenuExtraction({ filePath, mimeType, url, venueId }) {
  let text, buffer, hash;
  // PDF Upload
  if (filePath) {
    buffer = fs.readFileSync(filePath);
    hash = generateHash(buffer);
    const cached = await getCache(hash);
    if (cached) return cached;
    text = await extractTextFromPDF(buffer);
    const items = await extractMenuItemsFromText(text);
    await setCache(hash, items);
    return items;
  }
  // URL Input
  if (url) {
    // Use url as cache hash base
    hash = crypto.createHash("sha256").update(url).digest("hex");
    const cached = await getCache(hash);
    if (cached) return cached;
    text = await extractTextFromUrl(url);
    const items = await extractMenuItemsFromText(text);
    await setCache(hash, items);
    return items;
  }
  throw new Error("No menu file or URL provided");
}

// --- API ROUTE EXPORT --- //
async function handler(req, res) {
  debugLogs = [];
  log("API request received", {
    method: req.method,
    contentType: req.headers["content-type"],
    hasFile: !!req.file,
    bodyKeys: req.body ? Object.keys(req.body) : undefined,
    query: req.query,
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await checkOpenAIQuota())) {
    return res
      .status(429)
      .json({
        error: "OpenAI quota exceeded. Please top up your account.",
        code: "QUOTA_EXCEEDED",
      });
  }

  // Manual JSON body parsing for application/json requests
  if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => { raw += chunk; });
      req.on("end", resolve);
    });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
    const venueId = body.venueId;
    const url = body.url;
    if (!venueId) {
      return res.status(400).json({ error: "Missing venue ID in JSON body" });
    }
    if (!url) {
      return res.status(400).json({ error: "Missing menu URL in JSON body" });
    }
    try {
      const items = await processMenuExtraction({ venueId, url });
      const deduped = deduplicateMenuItems(items);
      if (!deduped.length) throw new Error("No valid menu items found");
      await supabase.from("menu_items").upsert(
        deduped.map((item) => ({
          ...item,
          venue_id: venueId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: ["venue_id", "name"] },
      );
      res.status(200).json({ success: true, count: deduped.length, items: deduped });
    } catch (error) {
      log("Processing error:", error.stack || error.message);
      res.status(500).json({
        error: "Menu extraction failed",
        detail: error.message,
        code: "EXTRACTION_FAILED",
        logs: debugLogs,
      });
    }
    return;
  } else {
    // Multer for file uploads
    upload.single("menu")(req, res, async (err) => {
      if (err) {
        log("Upload error:", err.message);
        return res
          .status(500)
          .json({ error: "File upload failed", detail: err.message });
      }
      const filePath = req.file?.path;
      const mimeType = req.file?.mimetype;
      const venueId = req.body.venueId || req.query.venueId;
      const url = req.body.url || req.query.url;

      if (!filePath && !url) {
        return res
          .status(400)
          .json({ error: "Please provide a menu file or a menu URL." });
      }
      if (!venueId) {
        return res.status(400).json({ error: "Missing venue ID" });
      }
      try {
        const items = await processMenuExtraction({
          filePath,
          mimeType,
          url,
          venueId,
        });
        const deduped = deduplicateMenuItems(items);
        if (!deduped.length) throw new Error("No valid menu items found");
        // Insert into db (optional - remove if not needed)
        await supabase.from("menu_items").upsert(
          deduped.map((item) => ({
            ...item,
            venue_id: venueId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: ["venue_id", "name"] },
        );
        res
          .status(200)
          .json({ success: true, count: deduped.length, items: deduped });
      } catch (error) {
        log("Processing error:", error.stack || error.message);
        res
          .status(500)
          .json({
            error: "Menu extraction failed",
            detail: error.message,
            code: "EXTRACTION_FAILED",
            logs: debugLogs,
          });
      } finally {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            log("Temp file cleaned up");
          } catch {}
        }
      }
    });
  }
}

export default handler;

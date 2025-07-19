import { extractMenuFromImage } from "@/lib/gptVisionMenuParser";
import { supabase } from "@/lib/supabase";
import { OpenAI } from "openai";
import fs from "fs";
import formidable, { Fields, Files, File } from "formidable";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractMenuFromImageUrl(imageUrl: string) {
  const prompt = `Extract ALL menu items from this menu. Include every single item with its price and category.\n\nReturn JSON format:\n{\n  "items": [\n    {\n      "name": "Item name",\n      "price": "£X.XX", \n      "category": "Category",\n      "description": "Description if available"\n    }\n  ]\n}\n\nMake sure to capture EVERY item - starters, mains, drinks, desserts, etc.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  });
  const text = response.choices[0]?.message?.content;
  try {
    const json = JSON.parse(text!);
    return json.items || [];
  } catch (err) {
    console.error("Failed to parse JSON from Vision API:", text);
    throw new Error("Invalid JSON response from GPT Vision");
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let items: any[] = [];
  let venueId: string | null = null;

  try {
    if (!supabase) throw new Error("Supabase client not initialized");

    // Handle multipart form (file upload)
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      const form = new formidable.IncomingForm({ multiples: false });
      form.parse(req, async (err: any, fields: Fields, files: Files) => {
        if (err) {
          return res.status(400).json({ success: false, error: "Failed to parse form data" });
        }
        let v1 = fields.venueId;
        let v2 = fields.venue_id ?? "";
        venueId = Array.isArray(v1) ? v1[0] : v1 || Array.isArray(v2) ? v2[0] : v2 || null;
        let fileField = files.file;
        const file: File | undefined = Array.isArray(fileField) ? fileField[0] : fileField;
        if (!file) {
          return res.status(400).json({ success: false, error: "No file uploaded." });
        }
        try {
          items = await extractMenuFromImage(file.filepath);
          fs.unlinkSync(file.filepath); // Clean up temp file
          await insertMenuItems(items, venueId, res);
        } catch (err: any) {
          return res.status(500).json({ success: false, error: err.message });
        }
      });
      return;
    }

    // Handle JSON body (imageUrl)
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        venueId = parsed.venueId || parsed.venue_id || null;
        if (parsed.imageUrl) {
          items = await extractMenuFromImageUrl(parsed.imageUrl);
        } else {
          return res.status(400).json({ success: false, error: "No file or imageUrl provided." });
        }
        await insertMenuItems(items, venueId, res);
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function insertMenuItems(items: any[], venueId: string | null, res: NextApiResponse) {
  if (!supabase) throw new Error("Supabase client not initialized");
  // Validate and filter items
  const validItems = (items || []).filter(
    (item: any) => item.name && item.price && item.category
  );

  if (validItems.length === 0) {
    return res.status(400).json({ success: false, error: "No valid menu items extracted." });
  }

  // Optionally: clear previous items for this venue
  if (venueId) {
    await supabase.from("menu_items").delete().eq("venue_id", venueId);
  }

  // Insert into Supabase
  const { error } = await supabase.from("menu_items").insert(
    validItems.map((item: any) => ({
      name: item.name,
      price: item.price,
      category: item.category,
      description: item.description || "",
      venue_id: venueId || null,
      available: true,
      created_at: new Date().toISOString(),
    }))
  );

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true, items: validItems });
} 
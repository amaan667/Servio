import { extractMenuFromImage } from "@/lib/gptVisionMenuParser";
import multer from "multer";
import * as nextConnect from "next-connect";
import { NextApiRequest, NextApiResponse } from "next";
import type { Request, Response } from "express";
import { supabase } from "@/lib/supabase";
import { OpenAI } from "openai";
import fs from "fs";

const upload = multer({ dest: "/tmp/uploads" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getNextConnect = () => ((nextConnect as any).default ? (nextConnect as any).default : (nextConnect as any));

const apiRoute = getNextConnect()({
  onError(error: any, req: NextApiRequest, res: NextApiResponse) {
    res.status(501).json({ error: `Something went wrong! ${error.message}` });
  },
});

apiRoute.use(upload.single("file"));

// Helper: Vision extraction from image URL
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

apiRoute.post(async (req: Request, res: Response) => {
  // Accept venueId from form-data, query, or JSON
  const venueId = (req as any).body?.venueId || (req as any).query?.venueId || (req as any).body?.venue_id;
  let items: any[] = [];

  try {
    if (!supabase) throw new Error("Supabase client not initialized");

    // Handle file upload
    if ((req as any).file) {
      const filePath = (req as any).file.path;
      items = await extractMenuFromImage(filePath);
      fs.unlinkSync(filePath); // Clean up temp file
    } else if ((req as any).body?.imageUrl) {
      // Handle image URL
      items = await extractMenuFromImageUrl((req as any).body.imageUrl);
    } else {
      return res.status(400).json({ success: false, error: "No file or imageUrl provided." });
    }

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

    res.status(200).json({ success: true, items: validItems });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default apiRoute; 
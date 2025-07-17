import formidable from "formidable";
import { uploadPDFToGCS, runDocumentAI } from "@/lib/menuOcrHelpers";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();

  form.parse(req, async (err: any, fields: formidable.Fields, files: formidable.Files) => {
    if (err) return res.status(500).json({ error: "File upload error" });
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = file.filepath;
    const fileName = `menus/${Date.now()}-${file.originalFilename}`;

    const mimetype = file.mimetype || "application/pdf";
    const gcsInputUri = await uploadPDFToGCS(filePath, fileName, mimetype);
    const ocrText = await runDocumentAI(gcsInputUri, mimetype);

    // GPT-4 structuring
    const parsedResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Extract and return this restaurant menu in JSON format:\n\n${ocrText}`,
          },
        ],
      }),
    });

    const gptJSON = await parsedResponse.json();
    let structuredMenu = [];
    try {
      structuredMenu = JSON.parse(gptJSON.choices[0].message.content);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse GPT-4 response", raw: gptJSON });
    }

    res.status(200).json({ ocrText, structuredMenu });
  });
} 
import formidable from "formidable";
import { uploadPDFToGCS, runVisionOCR, readOCRResult } from "@/lib/menuOcrHelpers";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error" });
    const file = files.file[0];
    const filePath = file.filepath;
    const fileName = `menus/${Date.now()}-${file.originalFilename}`;

    const gcsInputUri = await uploadPDFToGCS(filePath, fileName);
    const gcsOutputUri = `gs://menu-parser-bucket/results/${Date.now()}/`;

    await runVisionOCR(gcsInputUri, gcsOutputUri);
    const ocrText = await readOCRResult(gcsOutputUri);

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
    const structuredMenu = JSON.parse(gptJSON.choices[0].message.content);

    res.status(200).json({ ocrText });
  });
} 
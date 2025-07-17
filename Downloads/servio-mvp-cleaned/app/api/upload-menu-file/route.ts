import { uploadPDFToGCS, runVisionOCR, readOCRResult } from "@/lib/menuOcrHelpers";
import formidable from "formidable";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // formidable needs a Node.js IncomingMessage, so we convert the web Request
  const form = new formidable.IncomingForm();

  // Convert the web Request to a Node.js stream
  const buffer = Buffer.from(await req.arrayBuffer());
  const fakeReq: any = new Readable();
  fakeReq.push(buffer);
  fakeReq.push(null);
  fakeReq.headers = req.headers;
  fakeReq.method = req.method;

  return new Promise((resolve, reject) => {
    form.parse(fakeReq, async (err, fields, files) => {
      if (err) {
        resolve(new Response(JSON.stringify({ error: "File upload error" }), { status: 500 }));
        return;
      }
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
      let structuredMenu = null;
      try {
        structuredMenu = JSON.parse(gptJSON.choices[0].message.content);
      } catch (e) {
        // fallback: return raw text if parsing fails
        structuredMenu = { raw: gptJSON.choices[0].message.content };
      }

      resolve(new Response(JSON.stringify({ ocrText, structuredMenu }), { status: 200 }));
    });
  });
} 
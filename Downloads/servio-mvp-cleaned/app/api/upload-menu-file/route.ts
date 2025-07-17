import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper: Extract text from all pages of a PDF buffer
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // pdfjs-dist expects Uint8Array
  const uint8Array = new Uint8Array(buffer);

  // Load the PDF
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  let allText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ");
    allText += pageText + "\n";
  }
  return allText.trim();
}

export async function POST(req: Request) {
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
      if (!url.endsWith('.pdf')) {
        return new Response(JSON.stringify({ error: "Only PDF URLs are supported for direct extraction." }), { status: 400 });
      }
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      text = await extractTextFromPDF(buffer);
    } else if (base64 && mimetype === 'application/pdf') {
      const fileBuffer = Buffer.from(base64, "base64");
      text = await extractTextFromPDF(fileBuffer);
    } else {
      return new Response(JSON.stringify({ error: "No PDF file or URL provided." }), { status: 400 });
    }

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Failed to extract text from PDF. Make sure your PDF is text-based, not a scan or image." }), { status: 500 });
    }

    return new Response(JSON.stringify({ text }), { status: 200 });
  } catch (err: any) {
    console.error('API: error', err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to process menu file." }), { status: 500 });
  }
} 
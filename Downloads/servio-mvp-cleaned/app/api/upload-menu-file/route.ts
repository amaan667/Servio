import OpenAI from "openai";
import * as cheerio from "cheerio";
import { PDFDocument } from "pdf-lib";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to compress PDF
async function compressPDF(buffer: Buffer): Promise<Buffer> {
  try {
    console.log('PDF: Starting compression');
    const pdfDoc = await PDFDocument.load(buffer);
    
    // Get all pages
    const pages = pdfDoc.getPages();
    console.log('PDF: Original pages:', pages.length);
    
    // Create a new document with compressed settings
    const compressedDoc = await PDFDocument.create();
    
    // Copy pages with compression
    for (let i = 0; i < pages.length; i++) {
      const [copiedPage] = await compressedDoc.copyPages(pdfDoc, [i]);
      compressedDoc.addPage(copiedPage);
    }
    
    // Save with compression settings
    const compressedBytes = await compressedDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 20,
      updateFieldAppearances: false,
    });
    
    const originalSize = buffer.length;
    const compressedSize = compressedBytes.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log('PDF: Compression complete');
    console.log('PDF: Original size:', originalSize, 'bytes');
    console.log('PDF: Compressed size:', compressedSize, 'bytes');
    console.log('PDF: Compression ratio:', compressionRatio + '%');
    
    return Buffer.from(compressedBytes.buffer, compressedBytes.byteOffset, compressedBytes.byteLength);
  } catch (error) {
    console.error('PDF: Compression failed:', error);
    throw new Error('Failed to compress PDF');
  }
}

async function extractTextWithOcrSpace(file: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) throw new Error("Missing OCR_SPACE_API_KEY");

  console.log('OCR: Starting extraction with mimetype:', mimetype);
  console.log('OCR: File size:', file.length, 'bytes');

  const formData = new FormData();
  const fileName = "menu." + (mimetype.split("/")[1] || "pdf");
  formData.append("file", new Blob([file]), fileName);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("OCREngine", "2"); // Use more accurate OCR engine

  console.log('OCR: Sending request to OCR.space...');
  
  try {
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: apiKey,
      },
      body: formData as any,
    });

    console.log('OCR: Response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('OCR: HTTP error:', res.status, errorText);
      throw new Error(`OCR.space HTTP error: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log('OCR: Response received:', JSON.stringify(result, null, 2));
    
    if (!result) {
      throw new Error("OCR.space returned empty response");
    }
    
    if (result.IsErroredOnProcessing) {
      throw new Error(`OCR.space processing error: ${result.ErrorMessage || 'Unknown error'}`);
    }
    
    if (!result.ParsedResults || !result.ParsedResults[0]) {
      throw new Error("OCR.space returned no parsed results");
    }
    
    const extractedText = result.ParsedResults[0].ParsedText || "";
    console.log('OCR: Extracted text length:', extractedText.length);
    
    if (!extractedText.trim()) {
      throw new Error("OCR.space extracted empty text");
    }
    
    return extractedText;
  } catch (error: any) {
    console.error('OCR: Detailed error:', error);
    throw new Error(`OCR.space failed to extract text: ${error.message}`);
  }
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
      console.log('API: Request data - URL:', !!url, 'Base64:', !!base64, 'Mimetype:', mimetype);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 });
    }

    let text = "";
    if (url) {
      console.log('API: URL provided', url);
      // Determine if URL is PDF or HTML
      if (url.endsWith('.pdf')) {
        // Download PDF and OCR
        console.log('API: Processing PDF URL');
        const { buffer, mimetype: urlMime } = await fetchUrlAsBuffer(url);
        
        // Check file size and compress if needed
        let processedBuffer = buffer;
        const fileSizeKB = buffer.length / 1024;
        console.log('API: PDF file size:', fileSizeKB, 'KB');
        
        if (fileSizeKB > 1024) {
          console.log('API: PDF is large, attempting compression...');
          try {
            processedBuffer = await compressPDF(buffer);
            const compressedSizeKB = processedBuffer.length / 1024;
            console.log('API: Compressed PDF size:', compressedSizeKB, 'KB');
            
            if (compressedSizeKB > 1024) {
              return new Response(JSON.stringify({ 
                error: `PDF is still too large (${compressedSizeKB.toFixed(1)}KB) after compression. Please use a smaller file or try the Text Input option.` 
              }), { status: 400 });
            }
          } catch (compressionError) {
            console.error('API: PDF compression failed:', compressionError);
            return new Response(JSON.stringify({ 
              error: `PDF compression failed. Please use a smaller file or try the Text Input option.` 
            }), { status: 400 });
          }
        }
        
        text = await extractTextWithOcrSpace(processedBuffer, urlMime);
      } else {
        // Try HTML extraction
        console.log('API: Processing HTML URL');
        text = await extractTextFromHtmlUrl(url);
      }
    } else if (base64 && mimetype) {
      console.log('API: Processing base64 file');
      const fileBuffer = Buffer.from(base64, "base64");
      
      // Check file size and compress if needed
      let processedBuffer = fileBuffer;
      const fileSizeKB = fileBuffer.length / 1024;
      console.log('API: File size:', fileSizeKB, 'KB');
      
      if (fileSizeKB > 1024 && mimetype === 'application/pdf') {
        console.log('API: PDF is large, attempting compression...');
        try {
          processedBuffer = await compressPDF(fileBuffer);
          const compressedSizeKB = processedBuffer.length / 1024;
          console.log('API: Compressed PDF size:', compressedSizeKB, 'KB');
          
          if (compressedSizeKB > 1024) {
            return new Response(JSON.stringify({ 
              error: `PDF is still too large (${compressedSizeKB.toFixed(1)}KB) after compression. Please use a smaller file or try the Text Input option.` 
            }), { status: 400 });
          }
        } catch (compressionError) {
          console.error('API: PDF compression failed:', compressionError);
          return new Response(JSON.stringify({ 
            error: `PDF compression failed. Please use a smaller file or try the Text Input option.` 
          }), { status: 400 });
        }
      } else if (fileSizeKB > 1024) {
        return new Response(JSON.stringify({ 
          error: `File size (${fileSizeKB.toFixed(1)}KB) exceeds OCR.space limit (1024KB). Please use a smaller file or try the Text Input option.` 
        }), { status: 400 });
      }
      
      text = await extractTextWithOcrSpace(processedBuffer, mimetype);
    } else {
      return new Response(JSON.stringify({ error: "No file or URL provided." }), { status: 400 });
    }
    
    console.log('API: Extracted text length:', text.length);
    
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Failed to extract text from input." }), { status: 500 });
    }
    
    console.log('API: Calling GPT for menu extraction');
    const items = await extractMenuWithGPT(text);
    console.log('API: GPT returned', items.length, 'items');
    
    return new Response(JSON.stringify({ items }), { status: 200 });
  } catch (err: any) {
    console.error('API: error', err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to process menu file." }), { status: 500 });
  }
} 
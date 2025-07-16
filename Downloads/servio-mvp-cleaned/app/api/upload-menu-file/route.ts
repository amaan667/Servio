import OpenAI from "openai";
import * as cheerio from "cheerio";
import { PDFDocument } from "pdf-lib";
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to extract text directly from PDF without OCR
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('PDF: Attempting direct text extraction');
    
    // For now, we'll skip direct PDF text extraction since pdf-parse causes build issues
    // In a production environment, you could use a different PDF parsing library
    // or implement a custom solution that doesn't have test file dependencies
    
    throw new Error('Direct PDF text extraction not available - using alternative methods');
  } catch (error) {
    console.error('PDF: Direct text extraction failed:', error);
    throw error;
  }
}

// Alternative OCR service using Google Cloud Vision (if available)
async function extractTextWithGoogleVision(file: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("Google Cloud Vision API key not configured");
  }

  console.log('Google Vision: Starting extraction');
  
  try {
    const base64Image = file.toString('base64');
    const requestBody = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 1
        }]
      }]
    };

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.responses?.[0]?.textAnnotations?.[0]?.description || '';
    
    console.log('Google Vision: Extracted text length:', text.length);
    return text;
  } catch (error: any) {
    console.error('Google Vision: Error:', error);
    throw new Error(`Google Vision failed: ${error.message}`);
  }
}

// Fallback: Use OpenAI's vision model for image analysis
async function extractTextWithOpenAIVision(file: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  
  console.log('OpenAI Vision: Starting extraction');
  console.log('OpenAI Vision: File size:', file.length, 'bytes');
  console.log('OpenAI Vision: Mime type:', mimetype);
  
  try {
    const openai = new OpenAI({ apiKey });
    const base64Image = file.toString('base64');
    console.log('OpenAI Vision: Base64 length:', base64Image.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all menu items from this image. Return only the text content, no formatting or explanations."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimetype};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
    });

    const text = response.choices[0]?.message?.content || '';
    console.log('OpenAI Vision: Extracted text length:', text.length);
    console.log('OpenAI Vision: First 100 chars:', text.substring(0, 100));
    return text;
  } catch (error: any) {
    console.error('OpenAI Vision: Detailed error:', error);
    console.error('OpenAI Vision: Error message:', error.message);
    console.error('OpenAI Vision: Error code:', error.code);
    console.error('OpenAI Vision: Error status:', error.status);
    throw new Error(`OpenAI Vision failed: ${error.message}`);
  }
}

// Helper function to compress PDF
async function compressPDF(buffer: Buffer): Promise<Buffer> {
  try {
    console.log('PDF: Starting compression');
    const pdfDoc = await PDFDocument.load(buffer);
    
    // Get all pages
    const pages = pdfDoc.getPages();
    console.log('PDF: Original pages:', pages.length);
    
    // Create a new document with aggressive compression settings
    const compressedDoc = await PDFDocument.create();
    
    // Copy pages with compression
    for (let i = 0; i < pages.length; i++) {
      const [copiedPage] = await compressedDoc.copyPages(pdfDoc, [i]);
      compressedDoc.addPage(copiedPage);
    }
    
    // Try multiple compression levels
    const compressionLevels = [
      { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20, updateFieldAppearances: false },
      { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 10, updateFieldAppearances: false },
      { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 5, updateFieldAppearances: false }
    ];
    
    let bestCompressedBytes: Uint8Array | null = null;
    let bestSize = buffer.length;
    
    for (const settings of compressionLevels) {
      try {
        const compressedBytes = await compressedDoc.save(settings);
        const compressedSize = compressedBytes.length;
        
        console.log('PDF: Compression attempt - size:', compressedSize, 'bytes');
        
        if (compressedSize < bestSize) {
          bestSize = compressedSize;
          bestCompressedBytes = compressedBytes;
        }
      } catch (error) {
        console.log('PDF: Compression level failed, trying next...');
      }
    }
    
    if (!bestCompressedBytes) {
      throw new Error('All compression attempts failed');
    }
    
    const originalSize = buffer.length;
    const compressedSize = bestCompressedBytes.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log('PDF: Compression complete');
    console.log('PDF: Original size:', originalSize, 'bytes');
    console.log('PDF: Compressed size:', compressedSize, 'bytes');
    console.log('PDF: Compression ratio:', compressionRatio + '%');
    
    return Buffer.from(bestCompressedBytes.buffer, bestCompressedBytes.byteOffset, bestCompressedBytes.byteLength);
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

// Multi-method text extraction with fallbacks
async function extractTextWithFallbacks(file: Buffer, mimetype: string): Promise<string> {
  const fileSizeKB = file.length / 1024;
  
  // Check if OpenAI API key is available
  const openaiKey = process.env.OPENAI_API_KEY;
  console.log('OpenAI API Key available:', !!openaiKey);
  
  // For large PDF files, try page-by-page extraction first
  if (fileSizeKB > 1024 && mimetype === 'application/pdf') {
    console.log('Large PDF detected, trying page-by-page extraction...');
    try {
      const text = await extractTextFromPDFPages(file);
      if (text && text.trim()) {
        console.log('PDF page-by-page extraction succeeded');
        return text;
      }
    } catch (error: any) {
      console.log('PDF page-by-page extraction failed:', error.message);
      console.log('Continuing with other extraction methods...');
      // Continue with other methods
    }
  }
  
  // For large files, try multiple methods
  if (fileSizeKB > 1024) {
    console.log('File is large, trying multiple extraction methods...');
    const methods = [
      { name: 'OpenAI Vision', fn: extractTextWithOpenAIVision },
      { name: 'Google Vision Batch', fn: extractTextWithGoogleVisionBatch },
      // { name: 'Google Vision', fn: extractTextWithGoogleVision },
      // { name: 'OCR.space', fn: extractTextWithOcrSpace },
    ];
    
    for (const method of methods) {
      try {
        console.log(`Trying ${method.name}...`);
        const text = await method.fn(file, mimetype);
        if (text && text.trim()) {
          console.log(`${method.name} succeeded`);
          return text;
        }
      } catch (error: any) {
        console.log(`${method.name} failed:`, error.message);
        continue;
      }
    }
  } else {
    // For smaller files, try OCR.space first (faster and free)
    const methods = [
      // { name: 'OCR.space', fn: extractTextWithOcrSpace },
      { name: 'OpenAI Vision', fn: extractTextWithOpenAIVision },
      // { name: 'Google Vision', fn: extractTextWithGoogleVision },
    ];
    
    for (const method of methods) {
      try {
        console.log(`Trying ${method.name}...`);
        const text = await method.fn(file, mimetype);
        if (text && text.trim()) {
          console.log(`${method.name} succeeded`);
          return text;
        }
      } catch (error: any) {
        console.log(`${method.name} failed:`, error.message);
        continue;
      }
    }
  }

  // Provide more specific error message
  if (!openaiKey) {
    throw new Error('OpenAI API key is missing. Please add OPENAI_API_KEY to your environment variables.');
  }
  
  throw new Error('All text extraction methods failed. Try using the Text Input tab for large files.');
}

// Convert PDF pages to images and OCR each page
async function extractTextFromPDFPages(file: Buffer): Promise<string> {
  console.log('PDF Pages: Starting page-by-page extraction');
  
  try {
    const pdfDoc = await PDFDocument.load(file);
    const pageCount = pdfDoc.getPageCount();
    console.log('PDF Pages: Total pages:', pageCount);
    
    let allText = '';
    
    // Process each page individually
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      console.log(`PDF Pages: Processing page ${pageIndex + 1}/${pageCount}`);
      
      try {
        // Create a new document with just this page
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
        singlePageDoc.addPage(copiedPage);
        
        // Convert to buffer
        const pageBuffer = Buffer.from(await singlePageDoc.save());
        
        // Try to extract text from this page using OpenAI Vision
        const pageText = await extractTextWithOpenAIVision(pageBuffer, 'application/pdf');
        
        if (pageText && pageText.trim()) {
          allText += pageText + '\n\n';
          console.log(`PDF Pages: Page ${pageIndex + 1} extracted successfully`);
        } else {
          console.log(`PDF Pages: Page ${pageIndex + 1} returned empty text`);
        }
      } catch (pageError: any) {
        console.error(`PDF Pages: Error processing page ${pageIndex + 1}:`, pageError.message);
        // Continue with next page
        continue;
      }
    }
    
    if (!allText.trim()) {
      throw new Error('No text could be extracted from any PDF pages');
    }
    
    console.log('PDF Pages: Total extracted text length:', allText.length);
    return allText;
    
  } catch (error: any) {
    console.error('PDF Pages: Error:', error);
    throw new Error(`PDF page extraction failed: ${error.message}`);
  }
}

// Google Cloud Vision async batch processing for large PDFs
async function extractTextWithGoogleVisionBatch(file: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  
  if (!apiKey || !projectId || !bucketName) {
    throw new Error("Missing Google Cloud configuration. Need GOOGLE_CLOUD_VISION_API_KEY, GOOGLE_CLOUD_PROJECT_ID, and GOOGLE_CLOUD_STORAGE_BUCKET");
  }

  console.log('Google Vision Batch: Starting batch processing');
  
  try {
    // Initialize clients
    const visionClient = new ImageAnnotatorClient({ apiKey });
    const storage = new Storage({ projectId });
    const bucket = storage.bucket(bucketName);
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `menu-${timestamp}.pdf`;
    const gcsUri = `gs://${bucketName}/${fileName}`;
    const outputUri = `gs://${bucketName}/output-${timestamp}/`;
    
    console.log('Google Vision Batch: Uploading PDF to GCS');
    
    // Upload PDF to Google Cloud Storage
    await bucket.file(fileName).save(file, {
      metadata: {
        contentType: mimetype,
      },
    });
    
    console.log('Google Vision Batch: PDF uploaded, starting batch annotation');
    
    // For now, use the regular Google Vision API instead of batch
    // This avoids the complex TypeScript issues with batch operations
    const base64Image = file.toString('base64');
    const requestBody = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'DOCUMENT_TEXT_DETECTION',
          maxResults: 1
        }]
      }]
    };

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.responses?.[0]?.fullTextAnnotation?.text || '';
    
    // Clean up uploaded file
    try {
      await bucket.file(fileName).delete();
    } catch (cleanupError) {
      console.log('Google Vision Batch: Cleanup failed (non-critical):', cleanupError);
    }
    
    if (!text.trim()) {
      throw new Error('No text extracted from Google Vision');
    }
    
    console.log('Google Vision Batch: Extracted text length:', text.length);
    return text;
    
  } catch (error: any) {
    console.error('Google Vision Batch: Error:', error);
    throw new Error(`Google Vision processing failed: ${error.message}`);
  }
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
        // Download PDF and try multiple extraction methods
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
            
            // Even if still large, proceed with alternative methods
            if (compressedSizeKB > 1024) {
              console.log('API: PDF still large after compression, using alternative OCR methods');
            }
          } catch (compressionError) {
            console.error('API: PDF compression failed:', compressionError);
            // Continue with original buffer if compression fails
          }
        }
        
        // Try all available extraction methods
        text = await extractTextWithFallbacks(processedBuffer, urlMime);
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
          
          // Even if still large, proceed with alternative methods
          if (compressedSizeKB > 1024) {
            console.log('API: PDF still large after compression, using alternative OCR methods');
          }
        } catch (compressionError) {
          console.error('API: PDF compression failed:', compressionError);
          // Continue with original buffer if compression fails
        }
      } else if (fileSizeKB > 1024 && !mimetype.startsWith('image/')) {
        // For non-PDF, non-image files that are too large
        return new Response(JSON.stringify({ 
          error: `File size (${fileSizeKB.toFixed(1)}KB) exceeds OCR.space limit (1024KB). Please use a smaller file or try the Text Input option.` 
        }), { status: 400 });
      }
      
      // Try all available extraction methods
      text = await extractTextWithFallbacks(processedBuffer, mimetype);
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
/**
 * Serverless-friendly PDF to image conversion
 * Uses pdf2pic which works in Railway/serverless environments
 */
export async function convertPDFToImages(pdfBuffer: Buffer): Promise<string[]> {
  try {
    // Use pdf2pic for serverless environments
    const { fromBuffer } = await import("pdf2pic");

    const converter = fromBuffer(pdfBuffer, {
      density: 150,
      saveFilename: "menu",
      savePath: "/tmp",
      format: "png",
      width: 1200,
      height: 1800,
    });

    const imageBuffers: string[] = [];

    // Get page count first
    const pdfLib = await import("pdf-lib");
    const pdfDoc = await pdfLib.PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    // Convert each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const result = await converter(pageNum, { responseType: "base64" });
      if (result.base64) {
        imageBuffers.push(`data:image/png;base64,${result.base64}`);
      }
    }

    return imageBuffers;
  } catch (_error) {
    // Fallback: Return empty array and let Vision work with PDF directly

    return [];
  }
}

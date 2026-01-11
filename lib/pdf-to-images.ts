import * as pdfjsLib from "pdfjs-dist";
import { createCanvas } from "canvas";

// Set worker path for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function convertPDFToImages(pdfBuffer: Buffer): Promise<string[]> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const imageUrls: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport: viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;

      const imageDataUrl = canvas.toDataURL("image/png");
      imageUrls.push(imageDataUrl);
    }

    return imageUrls;
  } catch (_error) {

    throw new Error("Failed to convert PDF to images");
  }
}

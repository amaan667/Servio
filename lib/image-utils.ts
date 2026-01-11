/**
 * Image Utilities
 * Functions for image conversion, optimization, and processing
 */

/**
 * Convert an image to WEBP format
 * @param imageUrl - URL of the image to convert
 * @param quality - Quality of the WEBP output (0-100, default: 80)
 * @returns Promise<string> - Data URL of the converted image
 */
export async function convertToWebP(imageUrl: string, quality: number = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      try {
        const webpDataUrl = canvas.toDataURL("image/webp", quality / 100);
        resolve(webpDataUrl);
      } catch (_error) {
        reject(_error);
      }
    };

    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Convert multiple images to WEBP format
 * @param imageUrls - Array of image URLs to convert
 * @param quality - Quality of the WEBP output (0-100, default: 80)
 * @returns Promise<string[]> - Array of data URLs of the converted images
 */
export async function convertMultipleToWebP(
  imageUrls: string[],
  quality: number = 80
): Promise<string[]> {
  const conversions = imageUrls.map((url) => convertToWebP(url, quality));
  return Promise.all(conversions);
}

/**
 * Compress an image using canvas
 * @param imageUrl - URL of the image to compress
 * @param maxWidth - Maximum width of the compressed image
 * @param maxHeight - Maximum height of the compressed image
 * @param quality - Quality of the output (0-100, default: 80)
 * @returns Promise<string> - Data URL of the compressed image
 */
export async function compressImage(
  imageUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 80
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      try {
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality / 100);
        resolve(compressedDataUrl);
      } catch (_error) {
        reject(_error);
      }
    };

    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Convert data URL to Blob
 * @param dataUrl - Data URL to convert
 * @returns Blob
 */
export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

interface SupabaseStorage {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        blob: Blob,
        options: { contentType: string; upsert: boolean }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

/**
 * Upload image to Supabase Storage
 * @param supabase - Supabase client
 * @param bucket - Storage bucket name
 * @param path - Path in the bucket
 * @param imageBlob - Image blob to upload
 * @returns Promise<string> - Public URL of the uploaded image
 */
export async function uploadImageToStorage(
  supabase: SupabaseStorage,
  bucket: string,
  path: string,
  imageBlob: Blob
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, imageBlob, {
    contentType: imageBlob.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Convert and optimize image for web
 * @param imageUrl - URL of the image to optimize
 * @param options - Optimization options
 * @returns Promise<string> - Optimized image data URL
 */
export async function optimizeImageForWeb(
  imageUrl: string,
  options: {
    format?: "webp" | "jpeg" | "png";
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {
    /* Empty */
  }
): Promise<string> {
  const { format = "webp", quality = 80, maxWidth = 1920, maxHeight = 1080 } = options;

  // First compress the image
  const compressed = await compressImage(imageUrl, maxWidth, maxHeight, quality);

  // Then convert to desired format
  if (format === "webp") {
    return convertToWebP(compressed, quality);
  }

  return compressed;
}

/**
 * Get image dimensions
 * @param imageUrl - URL of the image
 * @returns Promise<{width: number, height: number}>
 */
export async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Check if browser supports WEBP
 * @returns boolean
 */
export function supportsWebP(): boolean {
  if (typeof window === "undefined") return false;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
}

/**
 * Lazy load image with intersection observer
 * @param imageUrl - URL of the image to load
 * @param element - Element to observe
 * @returns Promise<string> - Image URL when loaded
 */
export async function lazyLoadImage(imageUrl: string, element: HTMLElement): Promise<string> {
  return new Promise((resolve, _reject) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.unobserve(element);
            resolve(imageUrl);
          }
        });
      },
      { rootMargin: "50px" }
    );

    observer.observe(element);
  });
}

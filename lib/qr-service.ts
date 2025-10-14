/**
 * Centralized QR code generation service
 * Ensures consistent QR code generation across all components
 */

/**
 * Generate QR code URL using external service
 * Used for display and printing
 */
export function generateQRCodeUrl(orderUrl: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(orderUrl)}&format=png&margin=2&bgcolor=ffffff&color=000000`;
}

/**
 * Generate QR code data URL using local qrcode package
 * Used for advanced features and offline generation
 */
export function generateQRCodeDataUrl(orderUrl: string, size: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    // Dynamic import to avoid SSR issues
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(orderUrl, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }, (err: any, url: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(url);
        }
      });
    }).catch(reject);
  });
}

/**
 * Generate QR code for print with optimized settings
 */
export function generatePrintQRCodeUrl(orderUrl: string, size: number = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(orderUrl)}&format=png&margin=3&bgcolor=ffffff&color=000000&ecc=L`;
}

/**
 * Validate QR code URL
 */
export function isValidOrderUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname === '/order' && 
           urlObj.searchParams.has('venue') && 
           (urlObj.searchParams.has('table') || urlObj.searchParams.has('counter'));
  } catch {
    return false;
  }
}

/**
 * Get QR code size based on context
 */
export function getQRCodeSize(context: 'preview' | 'print' | 'download'): number {
  switch (context) {
    case 'preview':
      return 120;
    case 'print':
      return 300;
    case 'download':
      return 200;
    default:
      return 200;
  }
}

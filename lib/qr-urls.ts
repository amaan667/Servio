import { siteOrigin } from './site';

/**
 * Centralized QR URL generation service
 * Ensures consistent URL patterns across all QR components
 */

export interface QRParams {
  venue: string;
  table?: string;
  counter?: string;
  source: 'qr_table' | 'qr_counter';
  version?: number;
}

/**
 * Build order URL for QR codes
 * Standardizes the URL format across all components
 */
export function buildOrderUrl(
  venueId: string, 
  itemId: string, 
  type: 'table' | 'counter', 
  version?: number
): string {
  const baseUrl = siteOrigin();
  const source = type === 'table' ? 'qr_table' : 'qr_counter';
  const versionParam = version ? `&v=${version}` : '';
  
  return `${baseUrl}/order?venue=${venueId}&${type}=${encodeURIComponent(itemId)}&source=${source}${versionParam}`;
}

/**
 * Build QR generation page URL with selected tables
 */
export function buildQRGenerationUrl(venueId: string, tables: string[]): string {
  return `/dashboard/${venueId}/qr-codes`;
}

/**
 * Parse URL parameters consistently
 */
export function parseQRParams(searchParams: URLSearchParams): Partial<QRParams> {
  const venue = searchParams.get('venue');
  const table = searchParams.get('table');
  const counter = searchParams.get('counter');
  const source = searchParams.get('source') as QRParams['source'];
  const version = searchParams.get('v');
  
  const params: Partial<QRParams> = {};
  
  if (venue) params.venue = venue;
  if (table) params.table = table;
  if (counter) params.counter = counter;
  if (source) params.source = source;
  if (version) params.version = parseInt(version, 10);
  
  return params;
}

/**
 * Get tables from URL parameters (for QR generation page)
 */
export function getTablesFromUrl(searchParams: URLSearchParams): string[] | null {
  const tablesParam = searchParams.get('tables');
  const tableParam = searchParams.get('table');
  
  if (tablesParam) {
    return tablesParam.split(',').filter(Boolean);
  } else if (tableParam) {
    return [decodeURIComponent(tableParam)];
  }
  
  return null;
}

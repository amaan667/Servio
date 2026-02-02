/**
 * @fileoverview Servio API SDK
 * Provides a JavaScript SDK for external developers
 */

export interface ServioSDKConfig {
  apiKey: string;
  baseUrl?: string;
  version?: string;
  timeout?: number;
}

export interface Venue {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  timezone: string;
  currency: string;
}

export interface MenuItem {
  id: string;
  venueId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  available: boolean;
}

export interface Order {
  id: string;
  venueId: string;
  tableId?: string;
  sessionId?: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  specialInstructions?: string;
}

export interface Table {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  status: string;
  qrCode?: string;
}

export interface APIError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface APIResponse<T> {
  data?: T;
  error?: APIError;
  success: boolean;
}

/**
 * Servio API SDK
 */
export class ServioSDK {
  private config: ServioSDKConfig;
  private baseUrl: string;

  constructor(config: ServioSDKConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.servio.app',
      version: config.version || 'v1',
      timeout: config.timeout || 10000,
    };

    this.baseUrl = `${this.config.baseUrl}/api/${this.config.version}`;
  }

  /**
   * Make API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-API-Version': this.config.version!,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            message: data.message || 'Request failed',
            code: response.status.toString(),
          },
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  /**
   * Get venue by ID
   */
  async getVenue(venueId: string): Promise<APIResponse<Venue>> {
    return this.request<Venue>(`/venues/${venueId}`);
  }

  /**
   * List venues
   */
  async listVenues(params?: { limit?: number; offset?: number }): Promise<APIResponse<Venue[]>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    return this.request<Venue[]>(`/venues?${queryParams.toString()}`);
  }

  /**
   * Get menu items for a venue
   */
  async getMenuItems(venueId: string, params?: { categoryId?: string; limit?: number }): Promise<APIResponse<MenuItem[]>> {
    const queryParams = new URLSearchParams();
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return this.request<MenuItem[]>(`/venues/${venueId}/menu?${queryParams.toString()}`);
  }

  /**
   * Get menu item by ID
   */
  async getMenuItem(itemId: string): Promise<APIResponse<MenuItem>> {
    return this.request<MenuItem>(`/menu-items/${itemId}`);
  }

  /**
   * Create order
   */
  async createOrder(order: {
    venueId: string;
    tableId?: string;
    sessionId?: string;
    items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
  }): Promise<APIResponse<Order>> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<APIResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}`);
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<APIResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<APIResponse<Order>> {
    return this.request<Order>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Get tables for a venue
   */
  async getTables(venueId: string): Promise<APIResponse<Table[]>> {
    return this.request<Table[]>(`/venues/${venueId}/tables`);
  }

  /**
   * Get table by ID
   */
  async getTable(tableId: string): Promise<APIResponse<Table>> {
    return this.request<Table>(`/tables/${tableId}`);
  }

  /**
   * Seat table
   */
  async seatTable(tableId: string, sessionId: string): Promise<APIResponse<Table>> {
    return this.request<Table>(`/tables/${tableId}/seat`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  /**
   * Clear table
   */
  async clearTable(tableId: string): Promise<APIResponse<Table>> {
    return this.request<Table>(`/tables/${tableId}/clear`, {
      method: 'POST',
    });
  }

  /**
   * Get venue analytics
   */
  async getVenueAnalytics(venueId: string, period: string = '7d'): Promise<APIResponse<unknown>> {
    return this.request<unknown>(`/venues/${venueId}/analytics?period=${period}`);
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(venueId: string, period: string = '7d'): Promise<APIResponse<unknown>> {
    return this.request<unknown>(`/venues/${venueId}/analytics/revenue?period=${period}`);
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(venueId: string, period: string = '7d'): Promise<APIResponse<unknown>> {
    return this.request<unknown>(`/venues/${venueId}/analytics/orders?period=${period}`);
  }

  /**
   * Search venues
   */
  async searchVenues(query: string, params?: { limit?: number }): Promise<APIResponse<Venue[]>> {
    const queryParams = new URLSearchParams();
    queryParams.append('q', query);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return this.request<Venue[]>(`/venues/search?${queryParams.toString()}`);
  }

  /**
   * Get public menu for a venue
   */
  async getPublicMenu(venueId: string): Promise<APIResponse<{ categories: unknown[]; items: MenuItem[] }>> {
    return this.request<{ categories: unknown[]; items: MenuItem[] }>(`/public/venues/${venueId}/menu`);
  }

  /**
   * Get QR code for a table
   */
  async getTableQRCode(tableId: string): Promise<APIResponse<{ qrCode: string; url: string }>> {
    return this.request<{ qrCode: string; url: string }>(`/tables/${tableId}/qr`);
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<APIResponse<{ valid: boolean; userId?: string }>> {
    return this.request<{ valid: boolean; userId?: string }>('/auth/validate');
  }

  /**
   * Get API usage
   */
  async getUsage(params?: { startDate?: string; endDate?: string }): Promise<APIResponse<unknown>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    return this.request<unknown>(`/usage?${queryParams.toString()}`);
  }

  /**
   * Get API rate limits
   */
  async getRateLimits(): Promise<APIResponse<{ limit: number; remaining: number; reset: string }>> {
    return this.request<{ limit: number; remaining: number; reset: string }>('/rate-limits');
  }
}

/**
 * Create Servio SDK instance
 */
export function createServioSDK(config: ServioSDKConfig): ServioSDK {
  return new ServioSDK(config);
}

/**
 * Default export for browser usage
 */
if (typeof window !== 'undefined') {
  const win = window as unknown as Record<string, unknown>;
  win.ServioSDK = ServioSDK;
  win.createServioSDK = createServioSDK;
}

/**
 * Node.js export
 */
export default ServioSDK;

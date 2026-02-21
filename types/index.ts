/**
 * Shared Types Package
 * Centralized type definitions for the Servio platform
 * Single source of truth for all TypeScript types
 */

// ============================================================================
// Core Entity Types
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantEntity extends BaseEntity {
  organizationId: string;
  venueId?: string;
}

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
}

export interface AuthContext {
  userId: string;
  userEmail: string;
  userTier: "starter" | "pro" | "enterprise";
  userRole: "owner" | "manager" | "staff";
  venueId?: string;
  organizationId?: string;
}

export type UserRole = "owner" | "manager" | "staff";
export type UserTier = "starter" | "pro" | "enterprise";

// ============================================================================
// Venue Types
// ============================================================================

export interface Venue {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  settings: VenueSettings;
  subscriptionTier: UserTier;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VenueSettings {
  openingHours: OpeningHours[];
  orderSettings: OrderSettings;
  kdsSettings?: KDSSettings;
  notificationSettings: NotificationSettings;
}

export interface OpeningHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface OrderSettings {
  acceptOnlineOrders: boolean;
  acceptTakeaway: boolean;
  acceptDelivery: boolean;
  defaultPrepTime: number;
  maxPartySize: number;
  autoAcceptOrders: boolean;
}

export interface KDSSettings {
  stations: KDSStation[];
  alertTimeout: number;
  bumpSound: boolean;
}

export interface KDSStation {
  id: string;
  name: string;
  types: string[];
  alertTimeout: number;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

// ============================================================================
// Menu Types
// ============================================================================

export interface Menu {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  isActive: boolean;
  categories: MenuCategory[];
  items: MenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  menuId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl?: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  venueId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isPopular: boolean;
  prepTime: number;
  calories?: number;
  allergens: string[];
  dietaryInfo: DietaryInfo;
  modifiers?: MenuModifier[];
  inventoryItemId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DietaryInfo {
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isNutFree: boolean;
  isSpicy: boolean;
  spiceLevel?: number;
}

export interface MenuModifier {
  id: string;
  name: string;
  options: MenuModifierOption[];
  isRequired: boolean;
  maxSelections: number;
}

export interface MenuModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

// ============================================================================
// Order Types
// ============================================================================

export interface Order {
  id: string;
  venueId: string;
  tableId?: string;
  tableSessionId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentIntentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: OrderItemModifier[];
  notes?: string;
  status: OrderItemStatus;
  stationId?: string;
}

export interface OrderItemModifier {
  modifierId: string;
  modifierName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export type OrderItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentMethod = "card" | "cash" | "apple_pay" | "google_pay" | "pending";

// ============================================================================
// Table Types
// ============================================================================

export interface Table {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  section?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableSession {
  id: string;
  venueId: string;
  tableId: string;
  tableName: string;
  startedAt: string;
  endedAt?: string;
  status: TableSessionStatus;
  customerCount: number;
  orders: string[];
  totalSpent: number;
}

export type TableSessionStatus = "open" | "completed" | "cancelled";

// ============================================================================
// Reservation Types
// ============================================================================

export interface Reservation {
  id: string;
  venueId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time: string;
  partySize: number;
  tableId?: string;
  status: ReservationStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no-show";

// ============================================================================
// Staff Types
// ============================================================================

export interface StaffMember {
  id: string;
  venueId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  permissions: string[];
  invitedAt: string;
  joinedAt?: string;
}

export interface StaffInvitation {
  id: string;
  venueId: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentIntent {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  paymentMethodId?: string;
  clientSecret?: string;
  createdAt: string;
  succeededAt?: string;
}

export type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "canceled";

export interface StripeCheckoutSession {
  id: string;
  url: string;
  paymentIntentId: string;
  status: "open" | "complete" | "expired";
}

// ============================================================================
// AI Assistant Types
// ============================================================================

export interface AIAssistantConversation {
  id: string;
  venueId: string;
  userId: string;
  messages: AIAssistantMessage[];
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface AIAssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tools?: AIToolCall[];
  createdAt: string;
}

export interface AIToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface InventoryItem {
  id: string;
  venueId: string;
  name: string;
  sku?: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  costPerUnit: number;
  supplierId?: string;
  lastRestocked?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  venueId: string;
  itemId: string;
  type: "in" | "out" | "adjustment" | "waste";
  quantity: number;
  reason?: string;
  orderId?: string;
  staffId?: string;
  createdAt: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsSummary {
  venueId: string;
  period: "day" | "week" | "month" | "year";
  startDate: string;
  endDate: string;
  metrics: AnalyticsMetrics;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItems: TopItem[];
  revenueByDay: RevenueByDay[];
  ordersByType: Record<OrderType, number>;
  peakHours: PeakHour[];
}

export interface TopItem {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  orders: number;
}

export interface PeakHour {
  hour: number;
  orders: number;
  revenue: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export interface AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  isOperational: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  skipCache?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, HealthCheckResult>;
  timestamp: string;
  uptime: number;
}

export interface HealthCheckResult {
  status: "ok" | "error" | "warn";
  responseTime?: number;
  error?: string;
}

export interface SLIMetrics {
  timestamp: string;
  availability: {
    status: "healthy" | "degraded" | "unhealthy";
    uptimePercentage: number;
  };
  latency: {
    apiP50: number;
    apiP95: number;
    apiP99: number;
  };
  errorRate: {
    ratePercentage: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface EventPayload {
  type: string;
  timestamp: string;
  venueId?: string;
  userId?: string;
  data: Record<string, unknown>;
}

export type EventHandler = (payload: EventPayload) => Promise<void> | void;

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  signature?: string;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
}

// ============================================================================
// File Upload Types
// ============================================================================

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface UploadConfig {
  maxSize: number;
  allowedTypes: string[];
  destination: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Async<T> = Promise<T>;

export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E };

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

/**
 * @fileoverview GraphQL Schema Definition
 * Provides GraphQL schema for complex queries
 */

/**
 * GraphQL Schema Definition String
 * This schema can be used with Apollo Server or other GraphQL servers
 */
export const typeDefs = `
  scalar Date
  scalar JSON

  type Query {
    # Venue queries
    venue(id: ID!): Venue
    venues(first: Int, after: String): VenueConnection!
    searchVenues(query: String!, first: Int): [Venue!]!

    # Menu queries
    menuItem(id: ID!): MenuItem
    menuItems(venueId: ID!, categoryId: ID, first: Int, after: String): MenuItemConnection!
    menuCategories(venueId: ID!): [MenuCategory!]!

    # Order queries
    order(id: ID!): Order
    orders(venueId: ID!, status: OrderStatus, first: Int, after: String): OrderConnection!
    liveOrders(venueId: ID!): [Order!]!

    # Table queries
    table(id: ID!): Table
    tables(venueId: ID!, status: TableStatus): [Table!]!

    # Staff queries
    staff(id: ID!): Staff
    staffList(venueId: ID!): [Staff!]!

    # Inventory queries
    inventoryItem(id: ID!): InventoryItem
    inventoryItems(venueId: ID!): [InventoryItem!]!
    inventoryMovements(venueId: ID!, itemId: ID, first: Int): InventoryMovementConnection!

    # Analytics queries
    venueAnalytics(venueId: ID!, period: AnalyticsPeriod!): VenueAnalytics!
    revenueAnalytics(venueId: ID!, period: AnalyticsPeriod!): RevenueAnalytics!
    orderAnalytics(venueId: ID!, period: AnalyticsPeriod!): OrderAnalytics!
  }

  type Mutation {
    # Venue mutations
    createVenue(input: CreateVenueInput!): Venue!
    updateVenue(id: ID!, input: UpdateVenueInput!): Venue!
    deleteVenue(id: ID!): Boolean!

    # Menu mutations
    createMenuItem(input: CreateMenuItemInput!): MenuItem!
    updateMenuItem(id: ID!, input: UpdateMenuItemInput!): MenuItem!
    deleteMenuItem(id: ID!): Boolean!
    createMenuCategory(input: CreateMenuCategoryInput!): MenuCategory!
    updateMenuCategory(id: ID!, input: UpdateMenuCategoryInput!): MenuCategory!
    deleteMenuCategory(id: ID!): Boolean!

    # Order mutations
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    deleteOrder(id: ID!): Boolean!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!
    addOrderItem(orderId: ID!, input: AddOrderItemInput!): OrderItem!
    removeOrderItem(orderId: ID!, itemId: ID!): Boolean!

    # Table mutations
    createTable(input: CreateTableInput!): Table!
    updateTable(id: ID!, input: UpdateTableInput!): Table!
    deleteTable(id: ID!): Boolean!
    seatTable(tableId: ID!, sessionId: String!): Table!
    clearTable(tableId: ID!): Table!

    # Staff mutations
    createStaff(input: CreateStaffInput!): Staff!
    updateStaff(id: ID!, input: UpdateStaffInput!): Staff!
    deleteStaff(id: ID!): Boolean!
    inviteStaff(staffId: ID!, email: String!): StaffInvitation!

    # Inventory mutations
    createInventoryItem(input: CreateInventoryItemInput!): InventoryItem!
    updateInventoryItem(id: ID!, input: UpdateInventoryItemInput!): InventoryItem!
    deleteInventoryItem(id: ID!): Boolean!
    adjustStock(itemId: ID!, quantity: Float!, reason: String!): InventoryMovement!
  }

  type Subscription {
    # Real-time subscriptions
    orderUpdated(venueId: ID!): Order!
    tableUpdated(venueId: ID!): Table!
    inventoryUpdated(venueId: ID!): InventoryItem!
    liveOrders(venueId: ID!): Order!
  }

  # Types
  type Venue {
    id: ID!
    name: String!
    description: String
    address: String
    phone: String
    email: String
    website: String
    logo: String
    timezone: String!
    currency: String!
    settings: JSON
    createdAt: Date!
    updatedAt: Date!
  }

  type MenuCategory {
    id: ID!
    venueId: ID!
    name: String!
    description: String
    order: Int!
    items: [MenuItem!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type MenuItem {
    id: ID!
    venueId: ID!
    categoryId: ID
    name: String!
    description: String
    price: Float!
    image: String
    available: Boolean!
    modifiers: [MenuItemModifier!]!
    ingredients: [Ingredient!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type MenuItemModifier {
    id: ID!
    menuItemId: ID!
    name: String!
    options: [ModifierOption!]!
    required: Boolean!
    multiSelect: Boolean!
  }

  type ModifierOption {
    id: ID!
    modifierId: ID!
    name: String!
    price: Float!
  }

  type Ingredient {
    id: ID!
    name: String!
    allergens: [String!]!
    calories: Int
  }

  type Order {
    id: ID!
    venueId: ID!
    tableId: ID
    sessionId: String
    status: OrderStatus!
    items: [OrderItem!]!
    subtotal: Float!
    tax: Float!
    total: Float!
    paymentStatus: PaymentStatus!
    paymentMethod: PaymentMethod
    createdAt: Date!
    updatedAt: Date!
    completedAt: Date
  }

  type OrderItem {
    id: ID!
    orderId: ID!
    menuItemId: ID!
    menuItem: MenuItem!
    quantity: Int!
    price: Float!
    modifiers: [OrderItemModifier!]!
    specialInstructions: String
  }

  type OrderItemModifier {
    id: ID!
    orderItemId: ID!
    modifierOptionId: ID!
    modifierOption: ModifierOption!
    price: Float!
  }

  type Table {
    id: ID!
    venueId: ID!
    name: String!
    capacity: Int!
    status: TableStatus!
    currentSession: String
    currentOrderId: ID
    location: JSON
    qrCode: String
    createdAt: Date!
    updatedAt: Date!
  }

  type Staff {
    id: ID!
    venueId: ID!
    userId: ID!
    name: String!
    email: String!
    role: StaffRole!
    permissions: [String!]!
    isActive: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type StaffInvitation {
    id: ID!
    venueId: ID!
    staffId: ID!
    email: String!
    token: String!
    status: InvitationStatus!
    expiresAt: Date!
    createdAt: Date!
  }

  type InventoryItem {
    id: ID!
    venueId: ID!
    name: String!
    description: String
    unit: String!
    quantity: Float!
    minQuantity: Float!
    maxQuantity: Float!
    costPerUnit: Float!
    category: String
    location: String
    movements(first: Int, after: String): InventoryMovementConnection!
    createdAt: Date!
    updatedAt: Date!
  }

  type InventoryMovement {
    id: ID!
    itemId: ID!
    venueId: ID!
    type: MovementType!
    quantity: Float!
    reason: String
    performedBy: ID
    createdAt: Date!
  }

  # Connection types for pagination
  type VenueConnection {
    edges: [VenueEdge!]!
    pageInfo: PageInfo!
  }

  type VenueEdge {
    node: Venue!
    cursor: String!
  }

  type MenuItemConnection {
    edges: [MenuItemEdge!]!
    pageInfo: PageInfo!
  }

  type MenuItemEdge {
    node: MenuItem!
    cursor: String!
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    pageInfo: PageInfo!
  }

  type OrderEdge {
    node: Order!
    cursor: String!
  }

  type InventoryMovementConnection {
    edges: [InventoryMovementEdge!]!
    pageInfo: PageInfo!
  }

  type InventoryMovementEdge {
    node: InventoryMovement!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Analytics types
  type VenueAnalytics {
    venueId: ID!
    period: AnalyticsPeriod!
    totalOrders: Int!
    totalRevenue: Float!
    averageOrderValue: Float!
    totalCustomers: Int!
    tableTurnoverRate: Float!
    peakHours: [PeakHour!]!
  }

  type RevenueAnalytics {
    venueId: ID!
    period: AnalyticsPeriod!
    totalRevenue: Float!
    revenueByCategory: [RevenueByCategory!]!
    revenueByPaymentMethod: [RevenueByPaymentMethod!]!
    revenueTrend: [RevenueDataPoint!]!
  }

  type OrderAnalytics {
    venueId: ID!
    period: AnalyticsPeriod!
    totalOrders: Int!
    ordersByStatus: [OrdersByStatus!]!
    ordersByHour: [OrdersByHour!]!
    averagePreparationTime: Float!
    averageServiceTime: Float!
  }

  type PeakHour {
    hour: Int!
    orderCount: Int!
    revenue: Float!
  }

  type RevenueByCategory {
    category: String!
    revenue: Float!
    orderCount: Int!
  }

  type RevenueByPaymentMethod {
    method: PaymentMethod!
    revenue: Float!
    orderCount: Int!
  }

  type RevenueDataPoint {
    date: Date!
    revenue: Float!
    orders: Int!
  }

  type OrdersByStatus {
    status: OrderStatus!
    count: Int!
  }

  type OrdersByHour {
    hour: Int!
    count: Int!
  }

  # Enums
  enum OrderStatus {
    PENDING
    CONFIRMED
    PREPARING
    READY
    SERVED
    COMPLETED
    CANCELLED
  }

  enum PaymentStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    REFUNDED
  }

  enum PaymentMethod {
    CASH
    CARD
    MOBILE
    ONLINE
    SPLIT
  }

  enum TableStatus {
    AVAILABLE
    OCCUPIED
    RESERVED
    CLEANING
    MAINTENANCE
  }

  enum StaffRole {
    OWNER
    MANAGER
    SERVER
    KITCHEN
    HOST
  }

  enum InvitationStatus {
    PENDING
    ACCEPTED
    DECLINED
    EXPIRED
  }

  enum MovementType {
    ADJUSTMENT
    RESTOCK
    WASTE
    TRANSFER
    SALE
  }

  enum AnalyticsPeriod {
    TODAY
    WEEK
    MONTH
    QUARTER
    YEAR
    CUSTOM
  }

  # Input types
  input CreateVenueInput {
    name: String!
    description: String
    address: String
    phone: String
    email: String
    website: String
    logo: String
    timezone: String!
    currency: String!
    settings: JSON
  }

  input UpdateVenueInput {
    name: String
    description: String
    address: String
    phone: String
    email: String
    website: String
    logo: String
    timezone: String
    currency: String
    settings: JSON
  }

  input CreateMenuItemInput {
    venueId: ID!
    categoryId: ID
    name: String!
    description: String
    price: Float!
    image: String
    available: Boolean!
    modifierIds: [ID!]
    ingredientIds: [ID!]
  }

  input UpdateMenuItemInput {
    categoryId: ID
    name: String
    description: String
    price: Float
    image: String
    available: Boolean
    modifierIds: [ID!]
    ingredientIds: [ID!]
  }

  input CreateMenuCategoryInput {
    venueId: ID!
    name: String!
    description: String
    order: Int!
  }

  input UpdateMenuCategoryInput {
    name: String
    description: String
    order: Int
  }

  input CreateOrderInput {
    venueId: ID!
    tableId: ID
    sessionId: String
    items: [CreateOrderItemInput!]!
  }

  input UpdateOrderInput {
    tableId: ID
    sessionId: String
    items: [CreateOrderItemInput!]
  }

  input CreateOrderItemInput {
    menuItemId: ID!
    quantity: Int!
    modifiers: [CreateOrderItemModifierInput!]
    specialInstructions: String
  }

  input AddOrderItemInput {
    menuItemId: ID!
    quantity: Int!
    modifiers: [CreateOrderItemModifierInput!]
    specialInstructions: String
  }

  input CreateOrderItemModifierInput {
    modifierOptionId: ID!
  }

  input CreateTableInput {
    venueId: ID!
    name: String!
    capacity: Int!
    location: JSON
  }

  input UpdateTableInput {
    name: String
    capacity: Int
    location: JSON
  }

  input CreateStaffInput {
    venueId: ID!
    userId: ID!
    name: String!
    email: String!
    role: StaffRole!
    permissions: [String!]!
  }

  input UpdateStaffInput {
    name: String
    email: String
    role: StaffRole
    permissions: [String!]
    isActive: Boolean
  }

  input CreateInventoryItemInput {
    venueId: ID!
    name: String!
    description: String
    unit: String!
    quantity: Float!
    minQuantity: Float!
    maxQuantity: Float!
    costPerUnit: Float!
    category: String
    location: String
  }

  input UpdateInventoryItemInput {
    name: String
    description: String
    unit: String
    quantity: Float
    minQuantity: Float
    maxQuantity: Float
    costPerUnit: Float
    category: String
    location: String
  }
`;

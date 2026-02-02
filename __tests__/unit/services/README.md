# Unit Tests for Core Services

This document describes unit tests for core services in the Servio platform.

## Overview

This test suite provides comprehensive unit tests for all core services:
- OrderService
- MenuService
- TableService
- StaffService
- InventoryService
- ReservationService
- KDSService
- StripeService

## Test Structure

```
__tests__/
├── unit/
│   ├── services/
│   │   ├── OrderService.test.ts
│   │   ├── MenuService.test.ts
│   │   ├── TableService.test.ts
│   │   ├── StaffService.test.ts
│   │   ├── InventoryService.test.ts
│   │   ├── ReservationService.test.ts
│   │   ├── KDSService.test.ts
│   │   └── StripeService.test.ts
│   └── fixtures/
│       ├── orders.ts
│       ├── menus.ts
│       ├── tables.ts
│       └── staff.ts
```

## OrderService Tests

```typescript
// __tests__/unit/services/OrderService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderService } from '@/lib/services/OrderService';
import { OrderRepository } from '@/lib/repositories/order-repository';
import { createLogger } from '@/lib/structured-logger';

vi.mock('@/lib/repositories/order-repository');
vi.mock('@/lib/structured-logger');

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    mockOrderRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByVenueId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    orderService = new OrderService(mockOrderRepository, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: 'venue_123',
        items: [
          { menuItemId: 'menu_123', quantity: 2 },
        ],
      };

      const expectedOrder = {
        id: 'order_123',
        ...orderData,
        status: 'pending',
        total: 100,
        createdAt: new Date(),
      };

      mockOrderRepository.create.mockResolvedValue(expectedOrder);

      const result = await orderService.createOrder(orderData);

      expect(mockOrderRepository.create).toHaveBeenCalledWith(orderData);
      expect(result).toEqual(expectedOrder);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating order',
        expect.objectContaining({
          customerName: orderData.customerName,
          venueId: orderData.venueId,
        })
      );
    });

    it('should throw error if customer name is missing', async () => {
      const orderData = {
        customerName: '',
        customerEmail: 'john@example.com',
        venueId: 'venue_123',
        items: [],
      };

      await expect(orderService.createOrder(orderData)).rejects.toThrow(
        'Customer name is required'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create order',
        expect.objectContaining({
          error: 'Customer name is required',
        })
      );
    });

    it('should throw error if customer email is invalid', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'invalid-email',
        venueId: 'venue_123',
        items: [],
      };

      await expect(orderService.createOrder(orderData)).rejects.toThrow(
        'Invalid email address'
      );
    });

    it('should throw error if items array is empty', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: 'venue_123',
        items: [],
      };

      await expect(orderService.createOrder(orderData)).rejects.toThrow(
        'Order must have at least one item'
      );
    });

    it('should calculate total correctly', async () => {
      const orderData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        venueId: 'venue_123',
        items: [
          { menuItemId: 'menu_123', quantity: 2, price: 50 },
          { menuItemId: 'menu_456', quantity: 1, price: 25 },
        ],
      };

      const expectedOrder = {
        id: 'order_123',
        ...orderData,
        status: 'pending',
        total: 125, // 2*50 + 1*25
        createdAt: new Date(),
      };

      mockOrderRepository.create.mockResolvedValue(expectedOrder);

      const result = await orderService.createOrder(orderData);

      expect(result.total).toBe(125);
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      const orderId = 'order_123';
      const expectedOrder = {
        id: orderId,
        customerName: 'John Doe',
        status: 'pending',
      };

      mockOrderRepository.findById.mockResolvedValue(expectedOrder);

      const result = await orderService.getOrderById(orderId);

      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
      expect(result).toEqual(expectedOrder);
    });

    it('should return null if order not found', async () => {
      const orderId = 'order_999';
      mockOrderRepository.findById.mockResolvedValue(null);

      const result = await orderService.getOrderById(orderId);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Order not found',
        { orderId }
      );
    });
  });

  describe('getOrdersByVenueId', () => {
    it('should return orders for venue', async () => {
      const venueId = 'venue_123';
      const expectedOrders = [
        { id: 'order_123', venueId },
        { id: 'order_456', venueId },
      ];

      mockOrderRepository.findByVenueId.mockResolvedValue(expectedOrders);

      const result = await orderService.getOrdersByVenueId(venueId);

      expect(mockOrderRepository.findByVenueId).toHaveBeenCalledWith(venueId);
      expect(result).toEqual(expectedOrders);
    });

    it('should return empty array if no orders found', async () => {
      const venueId = 'venue_999';
      mockOrderRepository.findByVenueId.mockResolvedValue([]);

      const result = await orderService.getOrdersByVenueId(venueId);

      expect(result).toEqual([]);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = 'order_123';
      const newStatus = 'completed';

      const expectedOrder = {
        id: orderId,
        status: newStatus,
      };

      mockOrderRepository.update.mockResolvedValue(expectedOrder);

      const result = await orderService.updateOrderStatus(orderId, newStatus);

      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        status: newStatus,
      });
      expect(result).toEqual(expectedOrder);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Order status updated',
        { orderId, newStatus }
      );
    });

    it('should throw error if invalid status', async () => {
      const orderId = 'order_123';
      const invalidStatus = 'invalid_status';

      await expect(
        orderService.updateOrderStatus(orderId, invalidStatus)
      ).rejects.toThrow('Invalid order status');
    });
  });
});
```

## MenuService Tests

```typescript
// __tests__/unit/services/MenuService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MenuService } from '@/lib/services/MenuService';
import { MenuRepository } from '@/lib/repositories/menu-repository';

vi.mock('@/lib/repositories/menu-repository');

describe('MenuService', () => {
  let menuService: MenuService;
  let mockMenuRepository: any;

  beforeEach(() => {
    mockMenuRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByVenueId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getCategories: vi.fn(),
      getItemsByCategory: vi.fn(),
    };

    menuService = new MenuService(mockMenuRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createMenuItem', () => {
    it('should create a menu item successfully', async () => {
      const menuItemData = {
        name: 'Burger',
        description: 'Delicious burger',
        price: 10.99,
        venueId: 'venue_123',
        categoryId: 'category_123',
      };

      const expectedMenuItem = {
        id: 'menu_123',
        ...menuItemData,
        createdAt: new Date(),
      };

      mockMenuRepository.create.mockResolvedValue(expectedMenuItem);

      const result = await menuService.createMenuItem(menuItemData);

      expect(mockMenuRepository.create).toHaveBeenCalledWith(menuItemData);
      expect(result).toEqual(expectedMenuItem);
    });

    it('should throw error if name is missing', async () => {
      const menuItemData = {
        name: '',
        price: 10.99,
        venueId: 'venue_123',
      };

      await expect(menuService.createMenuItem(menuItemData)).rejects.toThrow(
        'Menu item name is required'
      );
    });

    it('should throw error if price is negative', async () => {
      const menuItemData = {
        name: 'Burger',
        price: -10,
        venueId: 'venue_123',
      };

      await expect(menuService.createMenuItem(menuItemData)).rejects.toThrow(
        'Price must be positive'
      );
    });
  });

  describe('getMenuByVenueId', () => {
    it('should return menu for venue', async () => {
      const venueId = 'venue_123';
      const expectedMenu = {
        categories: [
          { id: 'cat_123', name: 'Burgers' },
          { id: 'cat_456', name: 'Drinks' },
        ],
        items: [
          { id: 'menu_123', name: 'Cheeseburger', price: 10.99 },
          { id: 'menu_456', name: 'Cola', price: 2.99 },
        ],
      };

      mockMenuRepository.findByVenueId.mockResolvedValue(expectedMenu);

      const result = await menuService.getMenuByVenueId(venueId);

      expect(mockMenuRepository.findByVenueId).toHaveBeenCalledWith(venueId);
      expect(result).toEqual(expectedMenu);
    });
  });
});
```

## TableService Tests

```typescript
// __tests__/unit/services/TableService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TableService } from '@/lib/services/TableService';
import { TableRepository } from '@/lib/repositories/table-repository';

vi.mock('@/lib/repositories/table-repository');

describe('TableService', () => {
  let tableService: TableService;
  let mockTableRepository: any;

  beforeEach(() => {
    mockTableRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByVenueId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
    };

    tableService = new TableService(mockTableRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTable', () => {
    it('should create a table successfully', async () => {
      const tableData = {
        name: 'Table 1',
        capacity: 4,
        venueId: 'venue_123',
      };

      const expectedTable = {
        id: 'table_123',
        ...tableData,
        status: 'available',
        createdAt: new Date(),
      };

      mockTableRepository.create.mockResolvedValue(expectedTable);

      const result = await tableService.createTable(tableData);

      expect(mockTableRepository.create).toHaveBeenCalledWith(tableData);
      expect(result).toEqual(expectedTable);
    });

    it('should throw error if capacity is less than 1', async () => {
      const tableData = {
        name: 'Table 1',
        capacity: 0,
        venueId: 'venue_123',
      };

      await expect(tableService.createTable(tableData)).rejects.toThrow(
        'Capacity must be at least 1'
      );
    });
  });

  describe('updateTableStatus', () => {
    it('should update table status successfully', async () => {
      const tableId = 'table_123';
      const newStatus = 'occupied';

      const expectedTable = {
        id: tableId,
        status: newStatus,
      };

      mockTableRepository.updateStatus.mockResolvedValue(expectedTable);

      const result = await tableService.updateTableStatus(tableId, newStatus);

      expect(mockTableRepository.updateStatus).toHaveBeenCalledWith(tableId, newStatus);
      expect(result).toEqual(expectedTable);
    });
  });
});
```

## Running Tests

```bash
# Run all service tests
npm run test:services

# Run specific service tests
npm run test:services -- OrderService
npm run test:services -- MenuService

# Run with coverage
npm run test:services -- --coverage

# Run in watch mode
npm run test:services -- --watch
```

## Test Coverage Goals

- **Line Coverage**: 80%
- **Branch Coverage**: 75%
- **Function Coverage**: 85%
- **Statement Coverage**: 80%

## Fixtures

```typescript
// __tests__/unit/fixtures/orders.ts
export const mockOrder = {
  id: 'order_123',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  venueId: 'venue_123',
  status: 'pending',
  total: 100,
  items: [
    {
      id: 'item_123',
      menuItemId: 'menu_123',
      name: 'Burger',
      quantity: 2,
      price: 50,
    },
  ],
  createdAt: new Date('2024-01-15T10:30:00Z'),
};

export const mockOrders = [mockOrder];

export const mockOrderData = {
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  venueId: 'venue_123',
  items: [
    { menuItemId: 'menu_123', quantity: 2 },
  ],
};
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Unit Testing Patterns](https://martinfowler.com/bliki/UnitTest)

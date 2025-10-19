/**
 * Menu Entity Types
 */

export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  is_available: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
  position?: number;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuItemRequest {
  venueId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isAvailable?: boolean;
  imageUrl?: string;
}

export interface UpdateMenuItemRequest {
  itemId: string;
  venueId: string;
  updates: {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    is_available?: boolean;
    image_url?: string;
  };
}

export interface CreateCategoryRequest {
  venueId: string;
  name: string;
  description?: string;
  position?: number;
}

export interface UpdateCategoryRequest {
  categoryId: string;
  venueId: string;
  updates: {
    name?: string;
    description?: string;
    position?: number;
  };
}


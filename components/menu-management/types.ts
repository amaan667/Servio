export interface BaseMenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  is_available: boolean;
  image_url?: string | null;
  position?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthSession {
  user: {
    id: string;
    email?: string;
  };
  venue: {
    id: string;
    venue_id?: string;
  };
}

export interface MenuManagementProps {
  venueId: string;
  session: AuthSession;
  refreshTrigger?: number;
}

export type MenuItem = BaseMenuItem & { category_position?: number };

export interface NewItem {
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
}

export type BatchAction = "edit" | "unavailable" | "category" | "price" | "delete" | null;

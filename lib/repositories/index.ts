/**
 * @fileoverview Repository factory and exports
 * @module lib/repositories
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { OrderRepository } from "./order-repository";
import { MenuRepository } from "./menu-repository";
import { VenueRepository } from "./venue-repository";

/**
 * Repository factory
 */
export class RepositoryFactory {
  constructor(private supabase: SupabaseClient) {
    /* Empty */
  }

  get orders() {
    return new OrderRepository(this.supabase);
  }

  get menu() {
    return new MenuRepository(this.supabase);
  }

  get venues() {
    return new VenueRepository(this.supabase);
  }
}

/**
 * Create repository factory instance
 */
export function createRepositories(supabase: SupabaseClient) {
  return new RepositoryFactory(supabase);
}

// Re-export repositories
export { OrderRepository } from "./order-repository";
export { MenuRepository } from "./menu-repository";
export { VenueRepository } from "./venue-repository";
export { BaseRepository } from "./base-repository";

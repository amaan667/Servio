/**
 * @fileoverview Menu repository for database operations
 * @module lib/repositories/menu-repository
 */

import { BaseRepository } from './base-repository';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  category_id?: string;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  allergens?: string[];
  dietary_tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export class MenuRepository extends BaseRepository<MenuItem> {
  protected tableName = 'menu_items';

  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Find menu items by venue
   */
  async findByVenue(venueId: string, includeUnavailable: boolean = false): Promise<MenuItem[]> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('venue_id', venueId)
        .order('category')
        .order('name');

      if (!includeUnavailable) {
        query = query.eq('is_available', true);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[MENU_REPO] Error finding menu by venue', { error, venueId });
        throw error;
      }

      return (data as MenuItem[]) || [];
    } catch (error) {
      logger.error('[MENU_REPO] Unexpected error finding menu by venue', { error, venueId });
      throw error;
    }
  }

  /**
   * Find menu items by category
   */
  async findByCategory(venueId: string, categoryId: string): Promise<MenuItem[]> {
    return this.findAll({
      venue_id: venueId,
      category_id: categoryId,
      is_available: true,
    } as Partial<MenuItem>);
  }

  /**
   * Search menu items
   */
  async search(venueId: string, query: string): Promise<MenuItem[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('venue_id', venueId)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
        .eq('is_available', true)
        .order('name')
        .limit(50);

      if (error) {
        logger.error('[MENU_REPO] Error searching menu items', { error, venueId, query });
        throw error;
      }

      return (data as MenuItem[]) || [];
    } catch (error) {
      logger.error('[MENU_REPO] Unexpected error searching menu items', { error, venueId, query });
      throw error;
    }
  }

  /**
   * Get menu categories for venue
   */
  async getCategories(venueId: string): Promise<MenuCategory[]> {
    try {
      const { data, error } = await this.supabase
        .from('menu_categories')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        logger.error('[MENU_REPO] Error getting categories', { error, venueId });
        throw error;
      }

      return (data as MenuCategory[]) || [];
    } catch (error) {
      logger.error('[MENU_REPO] Unexpected error getting categories', { error, venueId });
      throw error;
    }
  }

  /**
   * Bulk update availability
   */
  async bulkUpdateAvailability(itemIds: string[], isAvailable: boolean): Promise<MenuItem[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({ is_available: isAvailable })
        .in('id', itemIds)
        .select();

      if (error) {
        logger.error('[MENU_REPO] Error bulk updating availability', { error, itemIds });
        throw error;
      }

      return (data as MenuItem[]) || [];
    } catch (error) {
      logger.error('[MENU_REPO] Unexpected error bulk updating availability', { error, itemIds });
      throw error;
    }
  }
}


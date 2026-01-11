/**
 * @fileoverview Base repository pattern for database operations
 * @module lib/repositories/base-repository
 */

import { SupabaseClient } from "@supabase/supabase-js";

import { EnhancedErrorTracker } from "@/lib/monitoring/sentry-enhanced";

export interface QueryOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Base repository class with common CRUD operations
 */
export abstract class BaseRepository<T> {
  protected abstract tableName: string;
  protected supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Find single record by ID
   */
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return EnhancedErrorTracker.trackDatabaseQuery("SELECT", this.tableName, async () => {
      const select = options?.select || "*";
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(select)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found

        throw error;
      }

      return data as T;
    });
  }

  /**
   * Find all records matching criteria
   */
  async findAll(criteria?: Partial<T>, options?: QueryOptions): Promise<T[]> {
    return EnhancedErrorTracker.trackDatabaseQuery("SELECT", this.tableName, async () => {
      const select = options?.select || "*";
      let query = this.supabase.from(this.tableName).select(select);

      // Apply criteria filters
      if (criteria) {
        Object.entries(criteria).forEach(([key, value]) => {
          if (value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {

        throw error;
      }

      return (data as T[]) || [];
    });
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    criteria?: Partial<T>,
    page: number = 1,
    limit: number = 20,
    options?: QueryOptions
  ): Promise<PaginationResult<T>> {
    return EnhancedErrorTracker.trackDatabaseQuery("SELECT", this.tableName, async () => {
      const select = options?.select || "*";
      const offset = (page - 1) * limit;

      // Get total count
      let countQuery = this.supabase
        .from(this.tableName)
        .select("*", { count: "exact", head: true });
      if (criteria) {
        Object.entries(criteria).forEach(([key, value]) => {
          if (value !== undefined) {
            countQuery = countQuery.eq(key, value);
          }
        });
      }
      const { count, error: countError } = await countQuery;

      if (countError) {

        throw countError;
      }

      // Get paginated data
      const data = await this.findAll(criteria, {
        ...options,
        limit,
        offset,
      });

      return {
        data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    });
  }

  /**
   * Create new record
   */
  async create(data: Partial<T>): Promise<T> {
    return EnhancedErrorTracker.trackDatabaseQuery("INSERT", this.tableName, async () => {
      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(data as never)
        .select()
        .single();

      if (error) {

        throw error;
      }

      return created as T;
    });
  }

  /**
   * Create multiple records
   */
  async createMany(records: Partial<T>[]): Promise<T[]> {
    return EnhancedErrorTracker.trackDatabaseQuery("INSERT", this.tableName, async () => {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(records as never[])
        .select();

      if (error) {

        throw error;
      }

      return (data as T[]) || [];
    });
  }

  /**
   * Update record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    return EnhancedErrorTracker.trackDatabaseQuery("UPDATE", this.tableName, async () => {
      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(data as never)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found

        throw error;
      }

      return updated as T;
    });
  }

  /**
   * Update multiple records matching criteria
   */
  async updateMany(criteria: Partial<T>, data: Partial<T>): Promise<T[]> {
    return EnhancedErrorTracker.trackDatabaseQuery("UPDATE", this.tableName, async () => {
      let query = this.supabase.from(this.tableName).update(data as never);

      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });

      const { data: updated, error } = await query.select();

      if (error) {

        throw error;
      }

      return (updated as T[]) || [];
    });
  }

  /**
   * Delete record by ID
   */
  async delete(id: string): Promise<boolean> {
    return EnhancedErrorTracker.trackDatabaseQuery("DELETE", this.tableName, async () => {
      const { error } = await this.supabase.from(this.tableName).delete().eq("id", id);

      if (error) {

        throw error;
      }

      return true;
    });
  }

  /**
   * Delete multiple records matching criteria
   */
  async deleteMany(criteria: Partial<T>): Promise<number> {
    return EnhancedErrorTracker.trackDatabaseQuery("DELETE", this.tableName, async () => {
      let query = this.supabase.from(this.tableName).delete();

      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query.select();

      if (error) {

        throw error;
      }

      return (data as T[])?.length || 0;
    });
  }

  /**
   * Count records matching criteria
   */
  async count(criteria?: Partial<T>): Promise<number> {
    return EnhancedErrorTracker.trackDatabaseQuery("SELECT", this.tableName, async () => {
      let query = this.supabase.from(this.tableName).select("*", { count: "exact", head: true });

      if (criteria) {
        Object.entries(criteria).forEach(([key, value]) => {
          if (value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      const { count, error } = await query;

      if (error) {

        throw error;
      }

      return count || 0;
    });
  }

  /**
   * Check if record exists
   */
  async exists(criteria: Partial<T>): Promise<boolean> {
    const count = await this.count(criteria);
    return count > 0;
  }
}

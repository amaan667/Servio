/**
 * @fileoverview Tenant-Level Configuration Management
 * Provides tenant-specific configuration management
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/monitoring/structured-logger';

export interface TenantConfig {
  id: string;
  tenantId: string;
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category: string;
  description?: string;
  isPublic: boolean;
  isEditable: boolean;
  defaultValue?: unknown;
  validation?: {
    type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'enum';
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
    required?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TenantConfigCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
}

/**
 * Tenant Configuration Manager
 */
export class TenantConfigManager {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Get configuration value for a tenant
   */
  async getConfig(tenantId: string, key: string): Promise<unknown | null> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_configs')
        .select('value')
        .eq('tenant_id', tenantId)
        .eq('key', key)
        .single();

      if (error) throw error;

      return (data as { value: unknown } | null)?.value ?? null;
    } catch (error) {
      logger.error('Failed to get tenant config', { tenantId, key, error });
      return null;
    }
  }

  /**
   * Get all configuration values for a tenant
   */
  async getAllConfigs(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_configs')
        .select('key, value')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const configs: Record<string, unknown> = {};
      for (const config of (data || []) as Array<{ key: string; value: unknown }>) {
        configs[config.key] = config.value;
      }

      return configs;
    } catch (error) {
      logger.error('Failed to get all tenant configs', { tenantId, error });
      return {};
    }
  }

  /**
   * Set configuration value for a tenant
   */
  async setConfig(tenantId: string, key: string, value: unknown): Promise<boolean> {
    try {
      // Validate value
      const configDef = await this.getConfigDefinition(key);
      if (configDef) {
        const validation = this.validateValue(value, configDef);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid value');
        }
      }

      // Upsert configuration
      const { error } = await this.supabase
        .from('tenant_configs')
        .upsert({
          tenant_id: tenantId,
          key,
          value,
          updated_at: new Date().toISOString(),
        } as never, {
          onConflict: 'tenant_id,key',
        });

      if (error) throw error;

      logger.info('Tenant config updated', { tenantId, key });
      return true;
    } catch (error) {
      logger.error('Failed to set tenant config', { tenantId, key, error });
      return false;
    }
  }

  /**
   * Set multiple configuration values for a tenant
   */
  async setConfigs(tenantId: string, configs: Record<string, unknown>): Promise<boolean> {
    try {
      const records = Object.entries(configs).map(([key, value]) => ({
        tenant_id: tenantId,
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.supabase
        .from('tenant_configs')
        .upsert(records as never, {
          onConflict: 'tenant_id,key',
        });

      if (error) throw error;

      logger.info('Tenant configs updated', { tenantId, count: Object.keys(configs).length });
      return true;
    } catch (error) {
      logger.error('Failed to set tenant configs', { tenantId, error });
      return false;
    }
  }

  /**
   * Delete configuration value for a tenant
   */
  async deleteConfig(tenantId: string, key: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('tenant_configs')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('key', key);

      if (error) throw error;

      logger.info('Tenant config deleted', { tenantId, key });
      return true;
    } catch (error) {
      logger.error('Failed to delete tenant config', { tenantId, key, error });
      return false;
    }
  }

  /**
   * Reset configuration to default value
   */
  async resetConfig(tenantId: string, key: string): Promise<boolean> {
    try {
      const configDef = await this.getConfigDefinition(key);
      if (!configDef || configDef.defaultValue === undefined) {
        throw new Error('No default value for this configuration');
      }

      return this.setConfig(tenantId, key, configDef.defaultValue);
    } catch (error) {
      logger.error('Failed to reset tenant config', { tenantId, key, error });
      return false;
    }
  }

  /**
   * Get configuration definition
   */
  async getConfigDefinition(key: string): Promise<TenantConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_config_definitions')
        .select('*')
        .eq('key', key)
        .single();

      if (error) throw error;

      return data || null;
    } catch (error) {
      logger.error('Failed to get config definition', { key, error });
      return null;
    }
  }

  /**
   * Get all configuration definitions
   */
  async getAllConfigDefinitions(): Promise<TenantConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_config_definitions')
        .select('*')
        .order('category, order', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get all config definitions', { error });
      return [];
    }
  }

  /**
   * Get configuration definitions by category
   */
  async getConfigDefinitionsByCategory(category: string): Promise<TenantConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_config_definitions')
        .select('*')
        .eq('category', category)
        .order('order', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get config definitions by category', { category, error });
      return [];
    }
  }

  /**
   * Get configuration categories
   */
  async getConfigCategories(): Promise<TenantConfigCategory[]> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_config_categories')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get config categories', { error });
      return [];
    }
  }

  /**
   * Validate configuration value
   */
  private validateValue(value: unknown, configDef: TenantConfig): { valid: boolean; error?: string } {
    if (!configDef.validation) {
      return { valid: true };
    }

    const validation = configDef.validation;
    const val = value;

    // Type validation
    switch (validation.type) {
      case 'string':
        if (typeof val !== 'string') {
          return { valid: false, error: 'Value must be a string' };
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(val as string)) {
          return { valid: false, error: 'Value does not match required pattern' };
        }
        break;

      case 'number':
        if (typeof val !== 'number') {
          return { valid: false, error: 'Value must be a number' };
        }
        if (validation.min !== undefined && (val as number) < validation.min) {
          return { valid: false, error: `Value must be at least ${validation.min}` };
        }
        if (validation.max !== undefined && (val as number) > validation.max) {
          return { valid: false, error: `Value must be at most ${validation.max}` };
        }
        break;

      case 'boolean':
        if (typeof val !== 'boolean') {
          return { valid: false, error: 'Value must be a boolean' };
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val as string)) {
          return { valid: false, error: 'Value must be a valid email address' };
        }
        break;

      case 'url':
        try {
          new URL(val as string);
        } catch {
          return { valid: false, error: 'Value must be a valid URL' };
        }
        break;

      case 'enum':
        if (validation.enum && !validation.enum.includes(val)) {
          return { valid: false, error: `Value must be one of: ${validation.enum.join(', ')}` };
        }
        break;
    }

    // Required validation
    if (validation.required && (val === undefined || val === null || val === '')) {
      return { valid: false, error: 'Value is required' };
    }

    return { valid: true };
  }

  /**
   * Export tenant configuration
   */
  async exportConfig(tenantId: string): Promise<Record<string, unknown>> {
    const configs = await this.getAllConfigs(tenantId);
    return configs;
  }

  /**
   * Import tenant configuration
   */
  async importConfig(tenantId: string, configs: Record<string, unknown>): Promise<boolean> {
    return this.setConfigs(tenantId, configs);
  }

  /**
   * Get configuration audit log
   */
  async getConfigAuditLog(tenantId: string, limit: number = 100): Promise<Array<{
    id: string;
    tenantId: string;
    key: string;
    oldValue: unknown;
    newValue: unknown;
    changedBy: string;
    changedAt: string;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('tenant_config_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get config audit log', { tenantId, error });
      return [];
    }
  }
}

// Singleton instance
let configManagerInstance: TenantConfigManager | null = null;

/**
 * Get tenant config manager singleton
 */
export function getTenantConfigManager(): TenantConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new TenantConfigManager();
  }
  return configManagerInstance;
}

/**
 * Get tenant configuration value
 */
export async function getTenantConfig(tenantId: string, key: string): Promise<unknown | null> {
  const manager = getTenantConfigManager();
  return manager.getConfig(tenantId, key);
}

/**
 * Set tenant configuration value
 */
export async function setTenantConfig(tenantId: string, key: string, value: unknown): Promise<boolean> {
  const manager = getTenantConfigManager();
  return manager.setConfig(tenantId, key, value);
}

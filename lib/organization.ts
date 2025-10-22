/**
 * Organization Management Service
 * Provides multi-tenancy, organization management, and user roles
 */

interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

interface OrganizationSettings {
  timezone: string;
  currency: string;
  features: string[];
  limits: {
    venues: number;
    users: number;
    orders: number;
  };
}

interface UserOrganization {
  user_id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  is_active: boolean;
  permissions: string[];
}

class OrganizationService {
  /**
   * Create new organization
   */
  async createOrganization(data: {
    name: string;
    plan?: 'free' | 'pro' | 'enterprise';
    ownerId: string;
  }): Promise<Organization> {
    // TODO: Implement with Supabase
    const organization: Organization = {
      id: `org_${Date.now()}`,
      name: data.name,
      plan: data.plan || 'free',
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        features: this.getPlanFeatures(data.plan || 'free'),
        limits: this.getPlanLimits(data.plan || 'free')
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add owner to organization
    await this.addUserToOrganization(data.ownerId, organization.id, 'owner');

    return organization;
  }

  /**
   * Add user to organization
   */
  async addUserToOrganization(
    userId: string, 
    organizationId: string, 
    role: 'owner' | 'admin' | 'manager' | 'staff'
  ): Promise<UserOrganization> {
    const userOrg: UserOrganization = {
      user_id: userId,
      organization_id: organizationId,
      role,
      is_active: true,
      permissions: this.getRolePermissions(role)
    };

    // TODO: Store in database
    return userOrg;
  }

  /**
   * Switch user's active organization
   */
  async switchOrganization(userId: string, organizationId: string): Promise<void> {
    // TODO: Update user's active organization
    console.log(`Switching user ${userId} to organization ${organizationId}`);
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<UserOrganization[]> {
    // TODO: Fetch from database
    return [];
  }

  /**
   * Update organization settings
   */
  async updateOrganizationSettings(
    organizationId: string, 
    settings: Partial<OrganizationSettings>
  ): Promise<void> {
    // TODO: Update in database
    console.log(`Updating organization ${organizationId} settings:`, settings);
  }

  /**
   * Get plan features
   */
  private getPlanFeatures(plan: string): string[] {
    const features = {
      free: ['basic_analytics', 'single_venue', 'basic_support'],
      pro: ['advanced_analytics', 'multiple_venues', 'priority_support', 'custom_branding'],
      enterprise: ['ai_insights', 'unlimited_venues', 'dedicated_support', 'white_label', 'api_access']
    };

    return features[plan as keyof typeof features] || features.free;
  }

  /**
   * Get plan limits
   */
  private getPlanLimits(plan: string) {
    const limits = {
      free: { venues: 1, users: 5, orders: 1000 },
      pro: { venues: 10, users: 50, orders: 10000 },
      enterprise: { venues: -1, users: -1, orders: -1 } // -1 = unlimited
    };

    return limits[plan as keyof typeof limits] || limits.free;
  }

  /**
   * Get role permissions
   */
  private getRolePermissions(role: string): string[] {
    const permissions = {
      owner: ['*'], // All permissions
      admin: ['manage_users', 'manage_venues', 'view_analytics', 'manage_settings'],
      manager: ['manage_venues', 'view_analytics', 'manage_orders'],
      staff: ['view_orders', 'manage_orders']
    };

    return permissions[role as keyof typeof permissions] || permissions.staff;
  }
}

export const organizationService = new OrganizationService();

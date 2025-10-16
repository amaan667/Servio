'use client';

import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Menu, 
  BarChart, 
  ChefHat,
  Table,
  CreditCard,
  Package
} from 'lucide-react';
import { canAccess, getRoleDisplayName, getRoleColor, UserRole } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';

interface RoleBasedNavigationProps {
  venueId: string;
  userRole: UserRole;
  userName: string;
}

export default function RoleBasedNavigation({ 
  venueId, 
  userRole, 
  userName 
}: RoleBasedNavigationProps) {
  const navigationItems = [
    {
      label: 'Dashboard',
      href: `/dashboard/${venueId}`,
      icon: LayoutDashboard,
      feature: 'dashboard',
      show: canAccess(userRole, 'dashboard'),
    },
    {
      label: 'Analytics',
      href: `/dashboard/${venueId}/analytics`,
      icon: BarChart,
      feature: 'analytics',
      show: canAccess(userRole, 'analytics'),
    },
    {
      label: 'Menu',
      href: `/dashboard/${venueId}/menu-management`,
      icon: Menu,
      feature: 'menu',
      show: canAccess(userRole, 'menu'),
    },
    {
      label: 'Inventory',
      href: `/dashboard/${venueId}/inventory`,
      icon: Package,
      feature: 'inventory',
      show: canAccess(userRole, 'inventory'),
    },
    {
      label: 'Staff',
      href: `/dashboard/${venueId}/staff`,
      icon: Users,
      feature: 'staff',
      show: canAccess(userRole, 'staff'),
    },
    {
      label: 'KDS',
      href: `/dashboard/${venueId}/kds`,
      icon: ChefHat,
      feature: 'kds',
      show: canAccess(userRole, 'kds'),
    },
    {
      label: 'Tables',
      href: `/dashboard/${venueId}/tables`,
      icon: Table,
      feature: 'tables',
      show: canAccess(userRole, 'tables'),
    },
    {
      label: 'POS',
      href: `/dashboard/${venueId}/pos`,
      icon: CreditCard,
      feature: 'payments',
      show: canAccess(userRole, 'payments'),
    },
    {
      label: 'Settings',
      href: `/dashboard/${venueId}/settings`,
      icon: Settings,
      feature: 'settings',
      show: canAccess(userRole, 'settings'),
    },
  ];

  const visibleItems = navigationItems.filter(item => item.show);

  return (
    <div className="flex items-center justify-between bg-white border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <Badge className={getRoleColor(userRole)}>
          {getRoleDisplayName(userRole)}
        </Badge>
        <span className="text-sm text-gray-600">{userName}</span>
      </div>
    </div>
  );
}


import { FileX, Package, Users, ShoppingCart } from 'lucide-react';

interface EmptyStateProps {
  icon?: 'file' | 'package' | 'users' | 'cart';
  title: string;
  description?: string;
  className?: string;
}

const iconMap = {
  file: FileX,
  package: Package,
  users: Users,
  cart: ShoppingCart,
};

export function EmptyState({ 
  icon = 'file', 
  title, 
  description, 
  className = '' 
}: EmptyStateProps) {
  const IconComponent = iconMap[icon];
  
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <IconComponent className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 max-w-sm">{description}</p>
      )}
    </div>
  );
}

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

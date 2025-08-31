import { Suspense } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { SignOutButton } from '@/components/sign-out-button';
import { DashboardContent } from './dashboard-content';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <SignOutButton />
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<div>Loading dashboard...</div>}>
            <DashboardContent />
          </Suspense>
        </main>
      </div>
    </ProtectedRoute>
  );
}

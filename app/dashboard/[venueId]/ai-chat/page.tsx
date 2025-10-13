import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function AIChatPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            AI Assistant
          </h1>
          <p className="text-lg text-foreground mt-2">
            Get help and insights from AI
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Chat Coming Soon</h3>
            <p className="text-gray-600">AI assistant functionality will be available soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
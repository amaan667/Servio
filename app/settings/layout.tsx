import UniversalHeader from '@/components/UniversalHeader';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <UniversalHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <NavigationBreadcrumb showBackButton={false} />
        {children}
      </div>
    </>
  );
}
import UniversalHeader from '@/components/UniversalHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UniversalHeader />
      {children}
    </>
  );
} 
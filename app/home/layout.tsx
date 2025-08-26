import AuthWrapper from '@/components/AuthWrapper';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthWrapper>
      {children}
    </AuthWrapper>
  );
}

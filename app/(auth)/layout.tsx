export default function Layout({ children }: { children: React.ReactNode }) {
  // No header/nav here—prevents flashing UI on callback
  return <>{children}</>;
}

import AuthProvider from "@/app/auth/AuthProvider";

interface LayoutWithAuthProps {

}

export default function LayoutWithAuth({ children }: LayoutWithAuthProps) {
  return (
    <html lang="en">
      <body>
        <AuthProvider initialSession={null}>{children}</AuthProvider>
      </body>
    </html>
  );
}

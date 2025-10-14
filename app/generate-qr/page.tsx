import { redirect } from 'next/navigation';

export default function GenerateQRPage() {
  // Redirect to dashboard QR codes - QR generation is a core product feature
  redirect('/dashboard');
}
import { redirect } from 'next/navigation';

export default function KitchenPage() {
  // Redirect to dashboard KDS - Kitchen Display System is a core product feature
  redirect('/dashboard');
}
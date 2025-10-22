import { redirect } from 'next/navigation';

// Demo route redirects to homepage
export default function DemoPage() {
  redirect('/');
}


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

'use client';

import SignUpForm from './signup-form';

export default function SignUpPage() {
  return <SignUpForm />;
}

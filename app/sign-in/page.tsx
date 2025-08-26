'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';

import SignInForm from './signin-form';

function SignInPageContent() {
  const [loading, setLoading] = useState(false);

  return <SignInForm loading={loading} />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}

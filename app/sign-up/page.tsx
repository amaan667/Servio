'use client';

import { useState } from 'react';

import SignUpForm from './signup-form';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  return <SignUpForm loading={loading} />;
}

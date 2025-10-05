'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabaseBrowser } from '@/lib/supabase/browser';
import Link from 'next/link';

interface SignUpFormProps {
  onGoogleSignIn: () => Promise<void>;
  isSigningUp?: boolean;
}

export default function SignUpForm({ onGoogleSignIn, isSigningUp = false }: SignUpFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    venueName: '',
    businessType: 'Restaurant',
  });

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate all required fields
    if (!formData.fullName.trim()) {
      setError('Full name is required.');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email address is required.');
      setLoading(false);
      return;
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }
    if (!formData.password.trim()) {
      setError('Password is required.');
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }
    if (!formData.venueName.trim()) {
      setError('Business name is required.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabaseBrowser().auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: formData.fullName,
            venue_name: formData.venueName,
            business_type: formData.businessType,
          },
        },
      });

      if (error) {
        // Log the actual error message for debugging
        
        // Check if the error is due to email already existing
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('already registered') || 
            errorMessage.includes('already exists') || 
            errorMessage.includes('user already registered') ||
            errorMessage.includes('email address is already registered') ||
            errorMessage.includes('email already in use') ||
            errorMessage.includes('duplicate key value') ||
            error.code === 'user_already_registered') {
          setError('You already have an account with this email. Please sign in instead.');
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Log the sign-up result for debugging
        
        // Check if this is actually a new user or an existing user
        // If the user has identities but we're trying to sign up with email, they might already exist
        if (data.user.identities && data.user.identities.length > 0) {
          const hasEmailIdentity = data.user.identities.some((identity: any) => identity.provider === 'email');
          const hasOAuthIdentity = data.user.identities.some((identity: any) => 
            identity.provider === 'google' || identity.provider === 'oauth'
          );
          
          // If user has OAuth identity but we're trying to add email, they already have an account
          if (hasOAuthIdentity && !hasEmailIdentity) {
            setError('You already have an account with Google. Please sign in instead.');
            setLoading(false);
            return;
          }
        }
        
        // Check if user is immediately authenticated (no email confirmation required)
        const { data: { user: currentUser } } = await supabaseBrowser().auth.getUser();
        
        if (currentUser) {
          // User is immediately authenticated, redirect to home
          router.push('/');
        } else {
          // User is not authenticated after sign-up attempt
          // This could mean either:
          // 1. New account requiring email confirmation
          // 2. Existing account (Supabase doesn't return error for existing emails)
          
          // Check if this is an existing account by attempting to sign in
          const { data: signInData, error: signInError } = await supabaseBrowser().auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          
          if (signInData.user && !signInError) {
            // Account already exists - sign them out and show error message
            await supabaseBrowser().auth.signOut();
            setError('You already have an account with this email. Please sign in instead.');
            setLoading(false);
            return;
          } else {
            // This is a new account, email confirmation is required
            router.push('/sign-in?message=' + encodeURIComponent('Please check your email to confirm your account before signing in.'));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Sign-up failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await onGoogleSignIn();
      // The redirect will happen automatically
    } catch (err: any) {
      console.error('[SIGN-UP] Google sign-up error:', err);
      setError(err.message || 'Google sign-up failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Sign up for your Servio account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error.includes('already have an account') ? (
                  <>
                    You already have an account with this email. Please{' '}
                    <Link href="/sign-in" className="underline hover:no-underline font-medium">
                      sign in
                    </Link>{' '}
                    instead.
                  </>
                ) : (
                  error
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Google Sign Up Button */}
          <Button
            onClick={handleGoogleSignUp}
            disabled={loading || isSigningUp}
            className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/>
                <path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/>
                <path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </g>
            </svg>
            {loading || isSigningUp ? 'Creating account...' : 'Sign up with Google'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-900">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Create a password"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueName">Business Name</Label>
              <Input
                id="venueName"
                type="text"
                value={formData.venueName}
                onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                placeholder="Enter your business name"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <select
                id="businessType"
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="Restaurant">Restaurant</option>
                <option value="Cafe">Cafe</option>
                <option value="Coffee Shop">Coffee Shop</option>
                <option value="Bar">Bar</option>
                <option value="Food Truck">Food Truck</option>
                <option value="Takeaway">Takeaway</option>
                <option value="Bakery">Bakery</option>
                <option value="Fast Food">Fast Food</option>
                <option value="Fine Dining">Fine Dining</option>
                <option value="Casual Dining">Casual Dining</option>
                <option value="Pizzeria">Pizzeria</option>
                <option value="Bistro">Bistro</option>
                <option value="Pub">Pub</option>
                <option value="Brewery">Brewery</option>
                <option value="Juice Bar">Juice Bar</option>
                <option value="Ice Cream Shop">Ice Cream Shop</option>
                <option value="Deli">Deli</option>
                <option value="Catering">Catering</option>
                <option value="Food Court">Food Court</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-900">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-purple-600 hover:text-purple-500 font-medium">
              Sign in here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

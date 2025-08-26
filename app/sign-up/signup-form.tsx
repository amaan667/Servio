"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";
import { signUpUser, signInUser } from "@/lib/supabase";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";


interface SignUpFormProps {
  loading?: boolean;
}

export default function SignUpForm({ loading: externalLoading }: SignUpFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    venueName: "",
    venueType: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH] Sign-up form submission started', {
      email: formData.email,
    });

    setError(null);

    if (!formData.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!formData.password) {
      setError("Please enter your password.");
      return;
    }

    if (!formData.fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.venueName.trim()) {
      setError("Please enter your business name.");
      return;
    }

    if (!formData.venueType) {
      setError("Please select your business type.");
      return;
    }

    setLoading(true);

    try {
      console.log('[AUTH] Calling signUpUser');
      const result = await signUpUser(
        formData.email.trim(),
        formData.password,
        formData.fullName.trim(),
        formData.venueName.trim(),
        formData.venueType
      );

      if (result.success) {
        if (result.needsConfirmation) {
          console.log('[AUTH] Email confirmation required');
          setNeedsConfirmation(true);
        } else {
          console.log('[AUTH] Sign-up successful, redirecting immediately');
          // Redirect immediately after successful sign-up
          router.replace('/dashboard');
        }
      } else {
        console.log('[AUTH] Sign-up failed', { message: result.message });
        setError(result.message || "Unknown error");
      }
    } catch (error: any) {
      console.log('[AUTH] Unexpected error during sign-up', { message: error?.message });
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent you a confirmation link to {formData.email}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Click the link in your email to complete your account setup.
            </p>
            <Button
              onClick={() => setNeedsConfirmation(false)}
              variant="outline"
              className="mt-6"
            >
              Back to sign up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign up for Servio to start managing your business
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create your business account</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign Up Button */}
            <GoogleSignInButton
              onError={(error) => setError(error)}
              disabled={loading || externalLoading}
              className="w-full mb-4"
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Enter your full name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter your email"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Create a password"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueName">Business Name *</Label>
                <Input
                  id="venueName"
                  type="text"
                  value={formData.venueName}
                  onChange={(e) =>
                    setFormData({ ...formData, venueName: e.target.value })
                  }
                  placeholder="Enter your business name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueType">Business Type *</Label>
                <select
                  id="venueType"
                  value={formData.venueType}
                  onChange={(e) =>
                    setFormData({ ...formData, venueType: e.target.value })
                  }
                  className="w-full border rounded-md px-3 py-2"
                  disabled={loading}
                  required
                >
                  <option value="">Select business type...</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Cafe">Cafe</option>
                  <option value="Food Truck">Food Truck</option>
                  <option value="Coffee Shop">Coffee Shop</option>
                  <option value="Bar">Bar</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-servio-purple hover:text-servio-purple/80"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

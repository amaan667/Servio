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
import { signUpUser, signInWithGoogle } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export default function SignUpForm() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info("SIGNUP_FORM: Form submission started", {
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
      const result = await signUpUser(
        formData.email.trim(),
        formData.password,
        formData.fullName.trim(),
        formData.venueName.trim(),
        formData.venueType
      );

      if (result.success) {
        logger.info(
          "SIGNUP_FORM: Sign-up successful, redirecting to dashboard",
        );
        // Force page reload to sync auth state
        window.location.href = "/dashboard";
      } else {
        logger.error("SIGNUP_FORM: Sign-up failed", { error: result.message });
        setError(result.message || "Unknown error");
      }
    } catch (error: any) {
      logger.error("SIGNUP_FORM: Unexpected error during sign-up", { error });
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            <Button
              type="button"
              className="w-full mb-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              onClick={async () => {
                setLoading(true);
                setError(null);
                
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  console.error("Google sign-up error on sign-up page:", err);
                  setError("Google sign-up failed. Please try again.");
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
              Sign up with Google
            </Button>

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

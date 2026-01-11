"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase";
import {
  Users,
  Mail,
  Shield,
  Building,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

interface Invitation {

}

interface InvitationAcceptanceClientProps {

}

export default function InvitationAcceptanceClient({
  invitation,
  token,
}: InvitationAcceptanceClientProps) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/staff/invitations/${token}`, {

        },

          password,
        }),

      const data = await response.json();

      if (!response.ok) {
        // If the error is that user already exists, redirect to sign in
        if (response.status === 409) {
          setError(
            "An account with this email already exists. Please sign in to accept the invitation."
          );
          setTimeout(() => {
            router.push(
              `/sign-in?email=${encodeURIComponent(invitation.email)}&redirect=/invitation/${token}`
            );
          }, 3000);
          return;
        }
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Sign the user in after account creation
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({

        password,

      if (signInError) {
        throw new Error("Account created but failed to sign in. Please try signing in manually.");
      }

      setSuccess(true);

      // Redirect to the venue dashboard after a short delay
      setTimeout(() => {
        router.push(`/dashboard/${invitation.venue_id}`);
      }, 2000);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "staff":
        return "bg-green-100 text-green-800 border-green-200";
      case "kitchen":
        return "bg-orange-100 text-orange-800 border-orange-200";

    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return "👑";
      case "manager":
        return "🛡️";
      case "staff":
        return "👤";
      case "kitchen":
        return "👨‍🍳";

    }
  };

  if (success) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Servio!</h2>
          <p className="text-gray-600 mb-4">
            Your account has been created successfully. You now have access to{" "}
            <strong>{invitation.venue_name}</strong> as a{" "}
            <Badge className={getRoleColor(invitation.role)}>
              {getRoleIcon(invitation.role)} {invitation.role}
            </Badge>
          </p>
          <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-purple-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">You're Invited!</CardTitle>
        <p className="text-gray-600">
          Join the team at <strong>{invitation.venue_name}</strong>
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Invitation Details */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Invited as:</span>
            <Badge className={getRoleColor(invitation.role)}>
              {getRoleIcon(invitation.role)} {invitation.role}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Building className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Venue:</span>
            <span className="text-sm font-medium">{invitation.venue_name}</span>
          </div>

          {invitation.organization_name && (
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">Organization:</span>
              <span className="text-sm font-medium">{invitation.organization_name}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Invited by:</span>
            <span className="text-sm font-medium">{invitation.invited_by_name}</span>
          </div>
        </div>

        {/* Account Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={invitation.email}
              disabled
              className="h-11 bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              This is the email address the invitation was sent to
            </p>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              required
              className="h-11"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              className="h-11"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Accept Invitation & Create Account"
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            By accepting this invitation, you agree to join the team and will have access to the
            venue's systems.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

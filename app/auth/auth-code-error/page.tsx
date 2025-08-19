"use client";
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600">
            There was a problem signing you in. Please try again.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In Failed</CardTitle>
            <CardDescription>
              The authentication process was interrupted or failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              This can happen if:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
              <li>You cancelled the sign-in process</li>
              <li>There was a network error</li>
              <li>The authentication session expired</li>
            </ul>
            
            <div className="flex space-x-4">
              <Link href="/sign-in" className="flex-1">
                <Button className="w-full">
                  Try Again
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  Go Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

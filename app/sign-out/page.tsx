'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { clearAuthStorage } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignOutPage() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSignOut = async () => {
    setLoading(true);
    setMessage('Signing out...');
    
    try {
      console.log('[SIGN-OUT] Starting sign out process');
      
      // Use the universal sign out function
      await signOut();
      
      // Force clear all authentication storage
      clearAuthStorage();
      
      setMessage('Successfully signed out! Redirecting...');
      console.log('[SIGN-OUT] Sign out completed successfully');
      
      // Redirect to sign-in page
      setTimeout(() => {
        window.location.href = '/sign-in';
      }, 2000);
      
    } catch (error) {
      console.error('[SIGN-OUT] Error during sign out:', error);
      setMessage('Error during sign out. Please try again.');
      setLoading(false);
    }
  };

  const forceClear = () => {
    setLoading(true);
    setMessage('Force clearing all authentication data...');
    
    try {
      // Force clear all storage
      clearAuthStorage();
      
      // Clear any remaining cookies
      if (typeof document !== 'undefined') {
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }
      
      setMessage('All authentication data cleared! Redirecting...');
      console.log('[SIGN-OUT] Force clear completed');
      
      // Redirect to sign-in page
      setTimeout(() => {
        window.location.href = '/sign-in';
      }, 2000);
      
    } catch (error) {
      console.error('[SIGN-OUT] Error during force clear:', error);
      setMessage('Error during force clear. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign Out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 text-center">
            Are you sure you want to sign out? This will clear all authentication data.
          </p>
          
          {message && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-center">
              {message}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button 
              onClick={handleSignOut} 
              disabled={loading}
              className="flex-1"
              variant="destructive"
            >
              {loading ? 'Signing Out...' : 'Sign Out'}
            </Button>
            
            <Button 
              onClick={forceClear} 
              disabled={loading}
              className="flex-1"
              variant="outline"
            >
              {loading ? 'Clearing...' : 'Force Clear'}
            </Button>
          </div>
          
          <div className="text-center">
            <Button 
              onClick={() => window.history.back()} 
              disabled={loading}
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
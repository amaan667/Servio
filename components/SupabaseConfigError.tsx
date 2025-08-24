'use client';

import { getSupabaseConfigStatus } from '@/lib/supabaseClient';
import { AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function SupabaseConfigError() {
  const [copied, setCopied] = useState(false);
  const configStatus = getSupabaseConfigStatus();

  // Only show if Supabase is not configured
  if (configStatus.client) {
    return null;
  }

  const copyToClipboard = async () => {
    const envContent = `# Supabase Configuration (REQUIRED)
# Get these from your Supabase project dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# App URL (Optional - for OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000`;

    try {
      await navigator.clipboard.writeText(envContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Configuration Required</h2>
        </div>
        
        <div className="space-y-3 mb-6">
          <p className="text-gray-600">
            The dashboard requires Supabase configuration to work properly. Please set up your environment variables.
          </p>
          
          <div className="bg-gray-50 rounded-md p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Missing Configuration:</span>
            </div>
            <ul className="space-y-1 text-gray-600">
              {!configStatus.url && (
                <li>• NEXT_PUBLIC_SUPABASE_URL</li>
              )}
              {!configStatus.key && (
                <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={copyToClipboard}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy .env.local template'}
          </Button>
          
          <Button
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            className="w-full flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Go to Supabase Dashboard
          </Button>
          
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Reload after configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
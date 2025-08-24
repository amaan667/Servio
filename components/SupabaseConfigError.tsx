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
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Configuration Required</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Supabase configuration is missing. Some features may not work properly.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={copyToClipboard}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied!' : 'Copy Config'}
          </Button>
          <Button
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            size="sm"
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Setup
          </Button>
        </div>
      </div>
    </div>
  );
}
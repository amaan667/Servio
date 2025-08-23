import { AlertCircle, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

interface EnvironmentErrorProps {
  title?: string;
  message?: string;
  showSetupInstructions?: boolean;
}

export function EnvironmentError({ 
  title = "Configuration Error", 
  message = "Required environment variables are missing.",
  showSetupInstructions = true 
}: EnvironmentErrorProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const setupText = `# Required Environment Variables for Servio

# Database Configuration (Supabase) - REQUIRED
# Get these from your Supabase project dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Cloud Services - REQUIRED for menu upload/OCR
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
GCS_BUCKET_NAME=your-gcs-bucket-name

# OpenAI API - REQUIRED for menu extraction
OPENAI_API_KEY=sk-your-openai-api-key-here`;

    try {
      await navigator.clipboard.writeText(setupText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-red-900">{title}</h3>
              <p className="mt-1">{message}</p>
            </div>
            
            {showSetupInstructions && (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-md border border-red-200">
                  <h4 className="font-medium text-red-900 mb-2">Quick Setup:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-red-800">
                    <li>Copy the example environment file: <code className="bg-red-100 px-1 rounded">cp .env.local.example .env.local</code></li>
                    <li>Get your Supabase credentials from <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">supabase.com <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Add your credentials to the <code className="bg-red-100 px-1 rounded">.env.local</code> file</li>
                    <li>Restart the application</li>
                  </ol>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyToClipboard}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy Setup Template'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('/debug', '_blank')}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Debug Page
                  </Button>
                </div>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
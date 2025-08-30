'use client'
import { GoogleButton } from '@/components/GoogleButton'

export default function TestOAuthSimplePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">OAuth Test (Simple)</h1>
        
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Environment Check:</h2>
          <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}</p>
          <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}</p>
          <p>Site URL: {process.env.NEXT_PUBLIC_SITE_URL || "Not set"}</p>
        </div>

        <GoogleButton />

        <div className="text-sm text-gray-600">
          <p>This test uses the simplified OAuth implementation:</p>
          <ul className="list-disc list-inside ml-4">
            <li>Simple browser client with persistence</li>
            <li>Server client bound to cookies</li>
            <li>Route handler for callback</li>
            <li>No complex PKCE handling</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

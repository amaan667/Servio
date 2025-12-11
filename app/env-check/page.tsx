"use client";

import { useEffect, useState } from "react";

export default function EnvCheckPage() {
  const [clientVars, setClientVars] = useState<Record<string, string>>({
    /* Empty */
  });

  useEffect(() => {
    // Check environment variables available to the browser
    setClientVars({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "❌ MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
        : "❌ MISSING",
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Environment Variables Check</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Client-Side Variables (Browser)</h2>
          <p className="text-sm text-gray-600 mb-4">
            These are the variables accessible in the browser. They must have the NEXT_PUBLIC_
            prefix.
          </p>

          <div className="space-y-2">
            {Object.entries(clientVars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-sm">{key}:</span>
                <span
                  className={`font-mono text-sm ${value.includes("MISSING") ? "text-red-600" : "text-green-600"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">What This Means:</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✅</span>
              <span>
                If both show values (not "MISSING"), your Railway environment variables are
                configured correctly.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-red-600 mr-2">❌</span>
              <span>
                If they show "MISSING", you need to add these variables in Railway dashboard.
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-2">How to Fix in Railway:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Go to{" "}
              <a
                href="https://railway.app"
                target="_blank"
                className="text-blue-600 underline"
                rel="noreferrer"
              >
                railway.app
              </a>
            </li>
            <li>Open your servio-mvp-cleaned project</li>
            <li>Click on the "Variables" tab</li>
            <li>
              Add these variables:
              <div className="mt-2 ml-4 space-y-1 font-mono text-xs bg-gray-100 p-3 rounded">
                <div>NEXT_PUBLIC_SUPABASE_URL = https://cpwemmofzjfzbmqcgjrq.supabase.co</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbG...your-key-here</div>
              </div>
            </li>
            <li>Railway will auto-redeploy after adding variables</li>
            <li>Return to this page after deployment to verify</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

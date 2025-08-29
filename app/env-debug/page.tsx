"use client";

import { useEffect, useState } from "react";
import { siteOrigin } from "@/lib/site";

export default function EnvDebugPage() {
  const [envInfo, setEnvInfo] = useState<any>(null);

  useEffect(() => {
    const info = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      appUrl: process.env.APP_URL,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      windowLocation: typeof window !== 'undefined' ? window.location.href : 'server-side',
      windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'server-side',
      siteOriginResult: siteOrigin(),
      allEnvVars: Object.keys(process.env).filter(key => 
        key.includes('URL') || key.includes('SITE') || key.includes('APP')
      ).reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>)
    };
    
    setEnvInfo(info);
    console.log('[AUTH DEBUG] Environment debug info:', info);
  }, []);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Environment Debug</h1>
      
      {envInfo && (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-bold mb-2">Environment Variables:</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(envInfo, null, 2)}
            </pre>
          </div>
          
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="font-bold mb-2">Key Values:</h2>
            <p><strong>NODE_ENV:</strong> {envInfo.nodeEnv}</p>
            <p><strong>NEXT_PUBLIC_SITE_URL:</strong> {envInfo.nextPublicSiteUrl || 'NOT SET'}</p>
            <p><strong>APP_URL:</strong> {envInfo.appUrl || 'NOT SET'}</p>
            <p><strong>NEXT_PUBLIC_APP_URL:</strong> {envInfo.nextPublicAppUrl || 'NOT SET'}</p>
            <p><strong>siteOrigin() result:</strong> {envInfo.siteOriginResult}</p>
            <p><strong>window.location.origin:</strong> {envInfo.windowOrigin}</p>
          </div>
        </div>
      )}
    </div>
  );
}

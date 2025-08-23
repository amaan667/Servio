import { NextResponse } from 'next/server';
import { errorLogger } from '@/lib/error-logger';
import { createClient } from '@supabase/supabase-js';
import { Storage } from '@google-cloud/storage';
import OpenAI from 'openai';

export async function GET(request: Request) {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    environment: {},
    services: {},
    errors: [],
    warnings: [],
    summary: {}
  };

  console.log('[DEBUG-ALL] Starting comprehensive environment and service test...');

  try {
    // 1. Environment Variables Check
    console.log('[DEBUG-ALL] Checking environment variables...');
    const envVars = {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***HIDDEN***' : 'MISSING',
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***HIDDEN***' : 'MISSING',
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
      },
      // OpenAI
      OPENAI_API_KEY: {
        exists: !!process.env.OPENAI_API_KEY,
        value: process.env.OPENAI_API_KEY ? '***HIDDEN***' : 'MISSING',
        length: process.env.OPENAI_API_KEY?.length || 0
      },
      // Google Cloud
      GOOGLE_CREDENTIALS_B64: {
        exists: !!process.env.GOOGLE_CREDENTIALS_B64,
        value: process.env.GOOGLE_CREDENTIALS_B64 ? '***HIDDEN***' : 'MISSING',
        length: process.env.GOOGLE_CREDENTIALS_B64?.length || 0
      },
      GOOGLE_APPLICATION_CREDENTIALS: {
        exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
        value: process.env.GOOGLE_APPLICATION_CREDENTIALS ? '***HIDDEN***' : 'MISSING',
        length: process.env.GOOGLE_APPLICATION_CREDENTIALS?.length || 0
      },
      GOOGLE_PROJECT_ID: {
        exists: !!process.env.GOOGLE_PROJECT_ID,
        value: process.env.GOOGLE_PROJECT_ID || 'MISSING'
      },
      GCS_BUCKET_NAME: {
        exists: !!process.env.GCS_BUCKET_NAME,
        value: process.env.GCS_BUCKET_NAME || 'MISSING'
      },
      // App URLs
      NEXT_PUBLIC_APP_URL: {
        exists: !!process.env.NEXT_PUBLIC_APP_URL,
        value: process.env.NEXT_PUBLIC_APP_URL || 'MISSING'
      },
      NEXT_PUBLIC_SITE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SITE_URL,
        value: process.env.NEXT_PUBLIC_SITE_URL || 'MISSING'
      },
      APP_URL: {
        exists: !!process.env.APP_URL,
        value: process.env.APP_URL || 'MISSING'
      },
      // Environment
      NODE_ENV: {
        exists: !!process.env.NODE_ENV,
        value: process.env.NODE_ENV || 'MISSING'
      }
    };

    results.environment = envVars;
    console.log('[DEBUG-ALL] Environment variables checked');

    // 2. Supabase Connection Test
    console.log('[DEBUG-ALL] Testing Supabase connection...');
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        
        const { data, error } = await supabase.from('venues').select('count').limit(1);
        
        if (error) {
          results.errors.push(`Supabase connection failed: ${error.message}`);
          console.log('[DEBUG-ALL] ❌ Supabase connection failed:', error.message);
        } else {
          results.services.supabase = { status: 'connected', data: 'Query successful' };
          console.log('[DEBUG-ALL] ✅ Supabase connection successful');
        }
      } else {
        results.warnings.push('Supabase credentials missing - skipping connection test');
        console.log('[DEBUG-ALL] ⚠️ Supabase credentials missing');
      }
    } catch (error) {
      results.errors.push(`Supabase test failed: ${error.message}`);
      console.log('[DEBUG-ALL] ❌ Supabase test failed:', error.message);
    }

    // 3. OpenAI Connection Test
    console.log('[DEBUG-ALL] Testing OpenAI connection...');
    try {
      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.models.list();
        results.services.openai = { status: 'connected', models: response.data.length };
        console.log('[DEBUG-ALL] ✅ OpenAI connection successful, models:', response.data.length);
      } else {
        results.warnings.push('OpenAI API key missing - skipping connection test');
        console.log('[DEBUG-ALL] ⚠️ OpenAI API key missing');
      }
    } catch (error) {
      results.errors.push(`OpenAI test failed: ${error.message}`);
      console.log('[DEBUG-ALL] ❌ OpenAI test failed:', error.message);
    }

    // 4. Google Cloud Connection Test
    console.log('[DEBUG-ALL] Testing Google Cloud connection...');
    try {
      if (process.env.GOOGLE_CREDENTIALS_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        let credentials;
        if (process.env.GOOGLE_CREDENTIALS_B64) {
          const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8');
          credentials = JSON.parse(credentialsJson);
        } else {
          credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!);
        }

        const storage = new Storage({ 
          credentials,
          projectId: process.env.GOOGLE_PROJECT_ID 
        });

        if (process.env.GCS_BUCKET_NAME) {
          const [exists] = await storage.bucket(process.env.GCS_BUCKET_NAME).exists();
          results.services.googleCloud = { 
            status: 'connected', 
            bucketExists: exists,
            projectId: credentials.project_id
          };
          console.log('[DEBUG-ALL] ✅ Google Cloud connection successful, bucket exists:', exists);
        } else {
          results.services.googleCloud = { 
            status: 'connected', 
            bucketExists: false,
            projectId: credentials.project_id,
            warning: 'No bucket name provided'
          };
          console.log('[DEBUG-ALL] ✅ Google Cloud connection successful, but no bucket name');
        }
      } else {
        results.warnings.push('Google Cloud credentials missing - skipping connection test');
        console.log('[DEBUG-ALL] ⚠️ Google Cloud credentials missing');
      }
    } catch (error) {
      results.errors.push(`Google Cloud test failed: ${error.message}`);
      console.log('[DEBUG-ALL] ❌ Google Cloud test failed:', error.message);
    }

    // 5. Generate Summary
    const missingVars = Object.entries(envVars)
      .filter(([key, value]) => !value.exists)
      .map(([key]) => key);

    results.summary = {
      totalTests: 3,
      successfulTests: Object.keys(results.services).length,
      missingVariables: missingVars,
      errorCount: results.errors.length,
      warningCount: results.warnings.length,
      isProduction: process.env.NODE_ENV === 'production',
      hasAllRequired: missingVars.length === 0
    };

    const duration = Date.now() - startTime;
    console.log('[DEBUG-ALL] ✅ Comprehensive test completed in', duration, 'ms');
    console.log('[DEBUG-ALL] Summary:', results.summary);

    // Log any errors to the error logger
    if (results.errors.length > 0) {
      results.errors.forEach(error => {
        errorLogger.logError(error, { debugResults: results }, request);
      });
    }

    return NextResponse.json({
      ...results,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = `Debug test failed: ${error.message}`;
    console.error('[DEBUG-ALL] ❌', errorMessage, 'after', duration, 'ms');
    errorLogger.logError(error, { 
      duration: `${duration}ms`,
      testType: 'comprehensive-debug'
    }, request);
    
    return NextResponse.json({ 
      error: errorMessage,
      duration: `${duration}ms`,
      partialResults: results
    }, { status: 500 });
  }
}
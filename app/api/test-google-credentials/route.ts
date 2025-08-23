import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { errorLogger } from '@/lib/error-logger';

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    console.log('[TEST-GOOGLE] Starting Google Cloud credentials test...');
    console.log('[TEST-GOOGLE] Request URL:', request.url);
    console.log('[TEST-GOOGLE] User Agent:', request.headers.get('user-agent'));
    
    // Log all environment variables related to Google
    const googleVars = {
      GOOGLE_CREDENTIALS_B64: {
        exists: !!process.env.GOOGLE_CREDENTIALS_B64,
        length: process.env.GOOGLE_CREDENTIALS_B64?.length || 0,
        preview: process.env.GOOGLE_CREDENTIALS_B64 ? `${process.env.GOOGLE_CREDENTIALS_B64.substring(0, 20)}...` : 'N/A'
      },
      GOOGLE_APPLICATION_CREDENTIALS: {
        exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
        length: process.env.GOOGLE_APPLICATION_CREDENTIALS?.length || 0,
        preview: process.env.GOOGLE_APPLICATION_CREDENTIALS ? `${process.env.GOOGLE_APPLICATION_CREDENTIALS.substring(0, 50)}...` : 'N/A'
      },
      GOOGLE_PROJECT_ID: {
        exists: !!process.env.GOOGLE_PROJECT_ID,
        value: process.env.GOOGLE_PROJECT_ID || 'N/A'
      },
      GCS_BUCKET_NAME: {
        exists: !!process.env.GCS_BUCKET_NAME,
        value: process.env.GCS_BUCKET_NAME || 'N/A'
      }
    };
    
    console.log('[TEST-GOOGLE] Environment variables status:', JSON.stringify(googleVars, null, 2));

    // Check for credentials
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const error = 'No credentials found. Need either GOOGLE_CREDENTIALS_B64 or GOOGLE_APPLICATION_CREDENTIALS';
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { googleVars }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    if (!process.env.GOOGLE_PROJECT_ID) {
      const error = 'GOOGLE_PROJECT_ID not found';
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { googleVars }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    if (!process.env.GCS_BUCKET_NAME) {
      const error = 'GCS_BUCKET_NAME not found';
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { googleVars }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    // Try to parse credentials
    let credentials;
    try {
      if (process.env.GOOGLE_CREDENTIALS_B64) {
        console.log('[TEST-GOOGLE] Using base64 encoded credentials');
        const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8');
        credentials = JSON.parse(credentialsJson);
        console.log('[TEST-GOOGLE] Base64 credentials decoded successfully, length:', credentialsJson.length);
      } else {
        console.log('[TEST-GOOGLE] Using regular credentials');
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!);
        console.log('[TEST-GOOGLE] Regular credentials parsed successfully');
      }
      console.log('[TEST-GOOGLE] ✅ Credentials parsed successfully');
      console.log('[TEST-GOOGLE] Project ID from credentials:', credentials.project_id);
      console.log('[TEST-GOOGLE] Client email from credentials:', credentials.client_email);
    } catch (parseError) {
      const error = `Failed to parse credentials: ${parseError.message}`;
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { 
        googleVars, 
        parseError: parseError.message,
        stack: parseError.stack 
      }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    // Try to initialize Storage client
    let storage;
    try {
      console.log('[TEST-GOOGLE] Initializing Storage client...');
      storage = new Storage({ 
        credentials,
        projectId: process.env.GOOGLE_PROJECT_ID 
      });
      console.log('[TEST-GOOGLE] ✅ Storage client initialized successfully');
    } catch (storageError) {
      const error = `Failed to initialize Storage: ${storageError.message}`;
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { 
        googleVars, 
        storageError: storageError.message,
        stack: storageError.stack 
      }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    // Try to access the bucket
    try {
      console.log('[TEST-GOOGLE] Testing bucket access...');
      const [exists] = await storage.bucket(process.env.GCS_BUCKET_NAME).exists();
      console.log('[TEST-GOOGLE] Bucket access test result:', exists);
      
      if (!exists) {
        const error = `Bucket ${process.env.GCS_BUCKET_NAME} does not exist`;
        console.log('[TEST-GOOGLE] ❌', error);
        errorLogger.logError(error, { googleVars }, request);
        return NextResponse.json({ 
          ok: false, 
          error,
          googleVars
        });
      }
      console.log('[TEST-GOOGLE] ✅ Bucket access successful');
    } catch (bucketError) {
      const error = `Failed to access bucket: ${bucketError.message}`;
      console.log('[TEST-GOOGLE] ❌', error);
      errorLogger.logError(error, { 
        googleVars, 
        bucketError: bucketError.message,
        stack: bucketError.stack 
      }, request);
      return NextResponse.json({ 
        ok: false, 
        error,
        googleVars
      });
    }

    const duration = Date.now() - startTime;
    console.log('[TEST-GOOGLE] ✅ All tests passed successfully in', duration, 'ms');
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Google Cloud credentials are working correctly',
      projectId: process.env.GOOGLE_PROJECT_ID,
      bucketName: process.env.GCS_BUCKET_NAME,
      credentialsProjectId: credentials.project_id,
      credentialsType: process.env.GOOGLE_CREDENTIALS_B64 ? 'base64' : 'json',
      duration: `${duration}ms`,
      googleVars
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = `Test failed: ${error.message}`;
    console.error('[TEST-GOOGLE] ❌', errorMessage, 'after', duration, 'ms');
    errorLogger.logError(error, { 
      duration: `${duration}ms`,
      testType: 'google-credentials'
    }, request);
    return NextResponse.json({ 
      ok: false, 
      error: errorMessage,
      duration: `${duration}ms`
    });
  }
}

import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function GET() {
  try {
    console.log('[TEST] Testing Google Cloud credentials...');
    console.log('[TEST] GOOGLE_APPLICATION_CREDENTIALS exists:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('[TEST] GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID);
    console.log('[TEST] GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME);

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return NextResponse.json({ 
        ok: false, 
        error: 'GOOGLE_APPLICATION_CREDENTIALS not found' 
      });
    }

    if (!process.env.GOOGLE_PROJECT_ID) {
      return NextResponse.json({ 
        ok: false, 
        error: 'GOOGLE_PROJECT_ID not found' 
      });
    }

    if (!process.env.GCS_BUCKET_NAME) {
      return NextResponse.json({ 
        ok: false, 
        error: 'GCS_BUCKET_NAME not found' 
      });
    }

    // Try to parse credentials
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('[TEST] Credentials parsed successfully');
      console.log('[TEST] Project ID from credentials:', credentials.project_id);
    } catch (parseError) {
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to parse credentials: ${parseError.message}` 
      });
    }

    // Try to initialize Storage client
    let storage;
    try {
      storage = new Storage({ 
        credentials,
        projectId: process.env.GOOGLE_PROJECT_ID 
      });
      console.log('[TEST] Storage client initialized successfully');
    } catch (storageError) {
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to initialize Storage: ${storageError.message}` 
      });
    }

    // Try to access the bucket
    try {
      const [exists] = await storage.bucket(process.env.GCS_BUCKET_NAME).exists();
      console.log('[TEST] Bucket access test:', exists);
      
      if (!exists) {
        return NextResponse.json({ 
          ok: false, 
          error: `Bucket ${process.env.GCS_BUCKET_NAME} does not exist` 
        });
      }
    } catch (bucketError) {
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to access bucket: ${bucketError.message}` 
      });
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Google Cloud credentials are working correctly',
      projectId: process.env.GOOGLE_PROJECT_ID,
      bucketName: process.env.GCS_BUCKET_NAME,
      credentialsProjectId: credentials.project_id
    });

  } catch (error) {
    console.error('[TEST] Error testing credentials:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Test failed: ${error.message}` 
    });
  }
}

import { NextResponse } from "next/server";
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    
    // Redirect to home page where users can sign in
    const redirectUrl = `${getBaseUrl()}/`;
    
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      type: 'unexpected_error'
    });
  }
}

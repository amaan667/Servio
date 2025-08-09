import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const origin = requestUrl.origin;

    // Handle OAuth errors
    if (error) {
      logger.error('OAuth error:', { error });
      return NextResponse.redirect(`${origin}/sign-in?error=oauth_error`);
    }

    if (!code) {
      logger.error('No code provided in OAuth callback');
      return NextResponse.redirect(`${origin}/sign-in?error=no_code`);
    }

    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    try {
      // Exchange code for session
      const { data: { user }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        logger.error('Session exchange error:', { error: sessionError });
        return NextResponse.redirect(`${origin}/sign-in?error=session_failed`);
      }

      if (!user) {
        logger.error('No user after code exchange');
        return NextResponse.redirect(`${origin}/sign-in?error=no_user`);
      }

      // Check if email is available
      if (!user.email) {
        logger.error('No email provided by Google');
        return NextResponse.redirect(`${origin}/sign-in?error=no_email`);
      }

      // Check if this is a password user trying to use Google
      const { data: { identities }, error: identityError } = await supabase.auth.admin.getUserIdentities(user.id);
      
      if (identityError) {
        logger.error('Error checking user identities:', { error: identityError });
      } else {
        const hasGoogleIdentity = identities?.some(id => id.provider === 'google');
        const hasEmailIdentity = identities?.some(id => id.provider === 'email');
        
        if (hasEmailIdentity && !hasGoogleIdentity) {
          logger.info('Email user attempting Google login - needs linking');
          return NextResponse.redirect(`${origin}/settings/account?link_google=true`);
        }
      }

      // Upsert profile (idempotent)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          onboarding_complete: false
        }, { 
          onConflict: 'id',
          returning: true 
        })
        .select()
        .single();

      if (profileError) {
        logger.error('Error upserting profile:', { error: profileError });
        return NextResponse.redirect(`${origin}/sign-in?error=profile_error`);
      }

      // Detect if this is their first login
      const isFirstLogin = profile && profile.created_at === profile.updated_at;

      if (isFirstLogin) {
        logger.info('First-time login detected, provisioning account');
        
        // Provision first-time login resources
        const { error: provisionError } = await supabase.rpc('provision_first_login', { 
          new_user_id: user.id 
        });

        if (provisionError) {
          logger.error('Error provisioning first login:', { error: provisionError });
        }

        logger.info('Redirecting to onboarding');
        return NextResponse.redirect(`${origin}/complete-profile`);
      }

      // Check if onboarding is incomplete
      if (profile && !profile.onboarding_complete) {
        logger.info('Onboarding incomplete, redirecting to complete-profile');
        return NextResponse.redirect(`${origin}/complete-profile`);
      }

      // All good - redirect to dashboard
      logger.info('Authentication successful, redirecting to dashboard');
      return NextResponse.redirect(`${origin}/dashboard`);

    } catch (error) {
      logger.error('Unexpected error in auth callback:', { error });
      return NextResponse.redirect(`${origin}/sign-in?error=unexpected`);
    }
  } catch (error) {
    logger.error('Critical error in auth callback:', { error });
    return NextResponse.redirect('/sign-in?error=critical');
  }
}
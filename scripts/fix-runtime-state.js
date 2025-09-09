#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRuntimeState() {
  try {
    console.log('🔍 Checking table_sessions for duplicates...');
    
    // Check table_sessions for the problematic table
    const { data: sessions, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', '8d3bdefc-042f-430d-abd3-b5a0f4ca2f66')
      .order('created_at');

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    console.log(`📊 Found ${sessions.length} table sessions for table 8d3bdefc-042f-430d-abd3-b5a0f4ca2f66:`);
    sessions.forEach((session, index) => {
      console.log(`   ${index + 1}. ID: ${session.id}, Status: ${session.status}, Created: ${session.created_at}`);
    });

    if (sessions.length > 1) {
      console.log('\n🗑️  Removing duplicate table sessions (keeping the oldest)...');
      
      // Keep the oldest session, remove the rest
      const sortedSessions = sessions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const sessionsToDelete = sortedSessions.slice(1);
      
      console.log(`   Keeping session: ${sortedSessions[0].id} (created: ${sortedSessions[0].created_at})`);
      
      for (const session of sessionsToDelete) {
        console.log(`   Deleting session: ${session.id} (created: ${session.created_at})`);
        const { error: deleteError } = await supabase
          .from('table_sessions')
          .delete()
          .eq('id', session.id);
        
        if (deleteError) {
          console.error(`   ❌ Failed to delete session ${session.id}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted session ${session.id}`);
        }
      }
    }

    // Check the other table too
    console.log('\n🔍 Checking table_sessions for table 10...');
    const { data: sessions2, error: sessionsError2 } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', '8e5a3882-618e-421c-b2ae-0e8bf9317a9c')
      .order('created_at');

    if (sessionsError2) {
      throw new Error(`Failed to fetch sessions for table 10: ${sessionsError2.message}`);
    }

    console.log(`📊 Found ${sessions2.length} table sessions for table 8e5a3882-618e-421c-b2ae-0e8bf9317a9c:`);
    sessions2.forEach((session, index) => {
      console.log(`   ${index + 1}. ID: ${session.id}, Status: ${session.status}, Created: ${session.created_at}`);
    });

    if (sessions2.length > 1) {
      console.log('\n🗑️  Removing duplicate table sessions for table 10...');
      
      const sortedSessions2 = sessions2.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const sessionsToDelete2 = sortedSessions2.slice(1);
      
      for (const session of sessionsToDelete2) {
        console.log(`   Deleting session: ${session.id}`);
        const { error: deleteError } = await supabase
          .from('table_sessions')
          .delete()
          .eq('id', session.id);
        
        if (deleteError) {
          console.error(`   ❌ Failed to delete session ${session.id}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted session ${session.id}`);
        }
      }
    }

    console.log('\n✅ Cleanup complete! Check your dashboard now.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixRuntimeState();

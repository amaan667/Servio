#!/usr/bin/env tsx

// Script to apply the AI Chat schema migration
// This runs the SQL migration using the Supabase client

import fs from 'fs';
import path from 'path';
import { createClient } from '../lib/supabase/server';

async function applyChatMigration() {
  try {
    console.log('🤖 Applying AI Chat schema migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/ai-chat-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded, size:', migrationSQL.length, 'bytes');
    
    // Create Supabase client
    const supabase = await createClient();
    
    console.log('🔗 Connected to Supabase');
    
    // Try to execute the migration using a simple approach
    // Split into statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements`);
    
    // For now, let's just verify if the tables exist
    console.log('🔍 Checking if tables already exist...');
    
    // Check if ai_chat_conversations table exists
    const { data: conversationsCheck, error: convError } = await supabase
      .from('ai_chat_conversations')
      .select('*')
      .limit(1);
    
    if (convError) {
      if (convError.code === 'PGRST116') {
        console.log('❌ ai_chat_conversations table does not exist - migration needed');
      } else {
        console.log('❌ Error checking ai_chat_conversations:', convError.message);
      }
    } else {
      console.log('✅ ai_chat_conversations table exists');
    }
    
    // Check if ai_chat_messages table exists
    const { data: messagesCheck, error: msgError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .limit(1);
    
    if (msgError) {
      if (msgError.code === 'PGRST116') {
        console.log('❌ ai_chat_messages table does not exist - migration needed');
      } else {
        console.log('❌ Error checking ai_chat_messages:', msgError.message);
      }
    } else {
      console.log('✅ ai_chat_messages table exists');
    }
    
    // Since direct SQL execution isn't available through the client,
    // we'll provide instructions for manual migration
    console.log('');
    console.log('⚠️  Direct SQL migration not available through client');
    console.log('📋 Manual migration required:');
    console.log('');
    console.log('1. Go to your Railway dashboard');
    console.log('2. Open the database console');
    console.log('3. Copy and paste the contents of migrations/ai-chat-schema.sql');
    console.log('4. Execute the SQL');
    console.log('');
    console.log('Or run this command locally if you have psql:');
    console.log('psql $DATABASE_URL -f migrations/ai-chat-schema.sql');
    
    // Let's also show the first few lines of the migration for reference
    console.log('');
    console.log('📄 Migration file preview:');
    const lines = migrationSQL.split('\n').slice(0, 10);
    lines.forEach(line => console.log('  ', line));
    console.log('  ... (truncated)');
    
  } catch (error) {
    console.error('❌ Migration check failed:', error);
    process.exit(1);
  }
}

// Run the migration check
applyChatMigration();

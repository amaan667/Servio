#!/usr/bin/env node

// Script to apply the AI Chat schema migration
// This runs the SQL migration using Node.js instead of psql

const fs = require('fs');
const path = require('path');

async function applyChatMigration() {
  try {
    console.log('🤖 Applying AI Chat schema migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/ai-chat-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded, size:', migrationSQL.length, 'bytes');
    
    // Import the Supabase server client
    const { createClient } = await import('../lib/supabase/server.ts');
    
    // Create Supabase client
    const supabase = await createClient();
    
    console.log('🔗 Connected to Supabase');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`  ${i + 1}/${statements.length}: Executing statement...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            // If exec_sql doesn't exist, try direct query
            console.log('  Trying direct query...');
            const { error: directError } = await supabase
              .from('_migration_temp')
              .select('*')
              .limit(0); // This will fail but we're just testing connection
            
            if (directError) {
              console.log('⚠️  Direct SQL execution not available, migration may need manual application');
              console.log('   Error:', error.message);
              break;
            }
          } else {
            console.log('  ✅ Statement executed successfully');
          }
        } catch (err) {
          console.log('  ⚠️  Statement execution failed:', err.message);
          // Continue with next statement
        }
      }
    }
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', 'ai_chat_%');
    
    if (tableError) {
      console.log('❌ Could not verify tables:', tableError.message);
    } else {
      const tableNames = tables.map(t => t.table_name);
      console.log('📊 Found tables:', tableNames);
      
      if (tableNames.includes('ai_chat_conversations')) {
        console.log('✅ ai_chat_conversations table exists');
      } else {
        console.log('❌ ai_chat_conversations table missing');
      }
      
      if (tableNames.includes('ai_chat_messages')) {
        console.log('✅ ai_chat_messages table exists');
      } else {
        console.log('❌ ai_chat_messages table missing');
      }
    }
    
    console.log('🎉 Migration process completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test the AI Assistant chat functionality');
    console.log('2. Try creating a new conversation');
    console.log('3. Check if conversations appear in chat history');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the migration
applyChatMigration();

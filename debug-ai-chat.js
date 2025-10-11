// Debug script to test AI chat database connection
// Run this with: node debug-ai-chat.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase URL and anon key here
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

async function testDatabaseConnection() {
  console.log('🔍 Testing AI Chat Database Connection...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Check if tables exist
    console.log('1. Checking if ai_chat_conversations table exists...');
    const { data: conversations, error: convError } = await supabase
      .from('ai_chat_conversations')
      .select('count')
      .limit(1);
    
    if (convError) {
      console.log('❌ ai_chat_conversations table error:', convError.message);
      if (convError.code === 'PGRST116' || convError.message.includes('does not exist')) {
        console.log('   → Table does not exist. You need to run the SQL migration.');
      }
    } else {
      console.log('✅ ai_chat_conversations table exists');
    }
    
    // Test 2: Check if ai_chat_messages table exists
    console.log('\n2. Checking if ai_chat_messages table exists...');
    const { data: messages, error: msgError } = await supabase
      .from('ai_chat_messages')
      .select('count')
      .limit(1);
    
    if (msgError) {
      console.log('❌ ai_chat_messages table error:', msgError.message);
    } else {
      console.log('✅ ai_chat_messages table exists');
    }
    
    // Test 3: Check if user can authenticate
    console.log('\n3. Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Authentication error:', authError.message);
    } else if (!user) {
      console.log('⚠️  No authenticated user (this is normal if not logged in)');
    } else {
      console.log('✅ User authenticated:', user.id);
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

// Instructions for the user
console.log('📋 INSTRUCTIONS:');
console.log('1. Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY with your actual values');
console.log('2. Run: node debug-ai-chat.js');
console.log('3. Check the output to see what\'s failing\n');

// Uncomment the line below after adding your credentials
// testDatabaseConnection();

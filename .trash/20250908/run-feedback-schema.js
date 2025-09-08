const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log('📖 Reading schema file...');
    const schemaPath = path.join(__dirname, 'feedback-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔧 Running schema...');
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('❌ Schema execution failed:', error.message);
      console.error('\n💡 Try running this SQL manually in your Supabase dashboard:');
      console.error('   SQL Editor → Copy/paste the contents of scripts/feedback-schema.sql');
      process.exit(1);
    }

    console.log('✅ Schema applied successfully!');
    console.log('🎉 Your feedback questions system is ready to use.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Try running this SQL manually in your Supabase dashboard:');
    console.error('   SQL Editor → Copy/paste the contents of scripts/feedback-schema.sql');
    process.exit(1);
  }
}

runSchema();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function createFeedbackQuestions() {
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
    console.log('📖 Reading feedback questions schema...');
    const schemaPath = path.join(__dirname, 'create-feedback-tables-manual.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔧 Creating feedback questions table...');
    
    // Split the SQL into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.log(`⚠️  Statement may have failed (this is often normal):`, error.message);
        }
      }
    }

    console.log('✅ Feedback questions table creation attempted!');
    console.log('🎉 Check your Supabase dashboard to see if the tables were created.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Try running this SQL manually in your Supabase dashboard:');
    console.error('   SQL Editor → Copy/paste the contents of scripts/create-feedback-tables-manual.sql');
    process.exit(1);
  }
}

createFeedbackQuestions();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runSchema() {
  try {
    console.log('Reading schema file...');
    const schemaPath = path.join(__dirname, 'feedback-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema...');
    const { error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('Error executing schema:', error);
      process.exit(1);
    }
    
    console.log('Schema executed successfully!');
    
    // Test if tables were created
    const { data: questions, error: questionsError } = await supabase
      .from('feedback_questions')
      .select('count')
      .limit(1);
    
    if (questionsError) {
      console.error('Error testing feedback_questions table:', questionsError);
    } else {
      console.log('feedback_questions table is accessible');
    }
    
    const { data: responses, error: responsesError } = await supabase
      .from('feedback_responses')
      .select('count')
      .limit(1);
    
    if (responsesError) {
      console.error('Error testing feedback_responses table:', responsesError);
    } else {
      console.log('feedback_responses table is accessible');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runSchema();

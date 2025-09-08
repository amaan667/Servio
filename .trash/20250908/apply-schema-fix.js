const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('[AUTH DEBUG] SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchemaFix() {
  try {
    console.log('[AUTH DEBUG] Applying table_session_links schema fix...');
    
    const sql = fs.readFileSync('./scripts/fix-table-session-links-schema.sql', 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('[AUTH DEBUG] Error applying schema fix:', error);
      process.exit(1);
    }
    
    console.log('[AUTH DEBUG] Schema fix applied successfully');
    console.log('[AUTH DEBUG] Result:', data);
    
  } catch (err) {
    console.error('[AUTH DEBUG] Failed to apply schema fix:', err.message);
    process.exit(1);
  }
}

applySchemaFix();

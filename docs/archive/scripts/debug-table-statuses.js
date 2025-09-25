const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStatuses() {
  console.log('Checking table statuses for merge...');
  
  const tableA = '68192cab-8658-4d45-bcc3-c52cf94f9917';
  const tableB = '419c6d0a-8df2-4d95-a83f-6593eb74df10';
  
  // Check table A session
  const { data: sessionA, error: errorA } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', tableA)
    .is('closed_at', null)
    .single();
    
  console.log('Table A session:', sessionA);
  if (errorA) console.log('Table A error:', errorA);
  
  // Check table B session  
  const { data: sessionB, error: errorB } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', tableB)
    .is('closed_at', null)
    .single();
    
  console.log('Table B session:', sessionB);
  if (errorB) console.log('Table B error:', errorB);
  
  // Check table info
  const { data: tableAInfo, error: tableAError } = await supabase
    .from('tables')
    .select('*')
    .eq('id', tableA)
    .single();
    
  console.log('Table A info:', tableAInfo);
  if (tableAError) console.log('Table A info error:', tableAError);
  
  const { data: tableBInfo, error: tableBError } = await supabase
    .from('tables')
    .select('*')
    .eq('id', tableB)
    .single();
    
  console.log('Table B info:', tableBInfo);
  if (tableBError) console.log('Table B info error:', tableBError);
  
  // Check if both tables are FREE
  if (sessionA && sessionB) {
    console.log('\\n=== MERGE VALIDATION ===');
    console.log('Table A status:', sessionA.status);
    console.log('Table B status:', sessionB.status);
    console.log('Both FREE?', sessionA.status === 'FREE' && sessionB.status === 'FREE');
  }
}

checkTableStatuses().catch(console.error);

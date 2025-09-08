const { createClient } = require('@supabase/supabase-js');

async function checkFeedbackSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log('🔍 Checking feedback_questions table structure...');
    
    // Try to get the table structure
    const { data, error } = await supabase
      .from('feedback_questions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing table:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Table structure:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📋 Table exists but is empty');
    }

    // Check if we can insert a test record
    console.log('\n🔍 Testing insert permissions...');
    const testQuestion = {
      venue_id: 'test-venue',
      question: 'Test question',
      question_type: 'rating',
      active: true
    };

    const { error: insertError } = await supabase
      .from('feedback_questions')
      .insert(testQuestion);

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
    } else {
      console.log('✅ Insert successful');
      
      // Clean up test data
      await supabase
        .from('feedback_questions')
        .delete()
        .eq('venue_id', 'test-venue');
      console.log('🧹 Test data cleaned up');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFeedbackSchema();

const { createClient } = require('@supabase/supabase-js');

async function testFeedbackPermissions() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const serviceClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log('🔍 Testing feedback_questions access with service role...');
    
    // Test with service role (should work)
    const { data: questions, error: serviceError } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .limit(5);
    
    if (serviceError) {
      console.error('❌ Service role error:', serviceError.message);
    } else {
      console.log('✅ Service role access successful');
      console.log(`📊 Found ${questions?.length || 0} questions`);
    }

    // Test with anon key (should fail due to RLS)
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    console.log('\n🔍 Testing feedback_questions access with anon key...');
    
    const { data: anonQuestions, error: anonError } = await anonClient
      .from('feedback_questions')
      .select('*')
      .limit(5);
    
    if (anonError) {
      console.log('✅ Anon access correctly blocked:', anonError.message);
    } else {
      console.log('⚠️  Anon access unexpectedly allowed');
      console.log(`📊 Found ${anonQuestions?.length || 0} questions`);
    }

    // Check if there are any questions in the table
    if (questions && questions.length > 0) {
      console.log('\n📋 Sample question structure:');
      console.log(JSON.stringify(questions[0], null, 2));
    }

    // Test inserting a question with service role
    console.log('\n🔍 Testing question creation with service role...');
    
    const testQuestion = {
      venue_id: 'test-venue-123',
      prompt: 'Test question for permissions',
      type: 'stars',
      choices: null,
      is_active: true,
      sort_index: 1
    };

    const { data: newQuestion, error: insertError } = await serviceClient
      .from('feedback_questions')
      .insert(testQuestion)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
    } else {
      console.log('✅ Insert successful');
      console.log('📝 New question ID:', newQuestion.id);
      
      // Clean up
      await serviceClient
        .from('feedback_questions')
        .delete()
        .eq('id', newQuestion.id);
      console.log('🧹 Test question cleaned up');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFeedbackPermissions();

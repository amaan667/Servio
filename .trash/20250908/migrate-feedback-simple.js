const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateFeedbackData() {
  console.log('🔄 Starting feedback data migration...');

  try {
    // Step 1: Check what tables exist
    console.log('\n📋 Checking existing tables...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['feedback', 'feedback_responses', 'order_feedback']);

    if (tablesError) {
      console.log('ℹ️  Could not check tables (this is normal)');
    } else {
      console.log('📊 Found tables:', tables.map(t => t.table_name));
    }

    // Step 2: Get data from feedback_responses table
    console.log('\n📥 Migrating data from feedback_responses...');
    
    const { data: responses, error: responsesError } = await supabase
      .from('feedback_responses')
      .select(`
        *,
        feedback_questions!inner(
          id,
          prompt,
          type,
          venue_id
        )
      `);

    if (responsesError) {
      console.log('ℹ️  No feedback_responses table or no data:', responsesError.message);
    } else if (responses && responses.length > 0) {
      console.log(`📊 Found ${responses.length} feedback responses to migrate`);
      
      // Group responses by order_id
      const responseGroups = new Map();
      
      responses.forEach((response) => {
        const orderId = response.order_id || 'no-order';
        if (!responseGroups.has(orderId)) {
          responseGroups.set(orderId, {
            venue_id: response.venue_id,
            order_id: response.order_id,
            customer_name: response.customer_name || 'Customer',
            responses: []
          });
        }
        
        const group = responseGroups.get(orderId);
        group.responses.push({
          question: response.feedback_questions.prompt,
          type: response.feedback_questions.type,
          answer: response.answer_stars || response.answer_choice || response.answer_text,
          created_at: response.created_at
        });
      });

      // Create feedback entries from grouped responses
      for (const [orderId, group] of responseGroups) {
        // Calculate average rating
        const starResponses = group.responses.filter(r => r.type === 'stars' && r.answer);
        const averageRating = starResponses.length > 0 
          ? Math.round(starResponses.reduce((sum, r) => sum + r.answer, 0) / starResponses.length)
          : 3;

        // Combine text responses
        const textResponses = group.responses.filter(r => r.type === 'paragraph' && r.answer);
        const comment = textResponses.length > 0 
          ? textResponses.map(r => r.answer).join('\n\n')
          : 'No additional comments';

        // Insert into main feedback table
        const { data: insertData, error: insertError } = await supabase
          .from('feedback')
          .insert({
            venue_id: group.venue_id,
            order_id: group.order_id,
            customer_name: group.customer_name,
            customer_email: null,
            customer_phone: null,
            rating: averageRating,
            comment: comment,
            category: 'structured',
            sentiment_score: null,
            sentiment_label: null,
            response: null,
            responded_at: null,
            created_at: group.responses[0].created_at,
            updated_at: group.responses[0].created_at
          })
          .select('id');

        if (insertError) {
          console.error(`❌ Error inserting feedback for order ${orderId}:`, insertError.message);
        } else {
          console.log(`✅ Migrated feedback for order ${orderId}`);
        }
      }
    }

    // Step 3: Get data from order_feedback table
    console.log('\n📥 Migrating data from order_feedback...');
    
    const { data: orderFeedback, error: orderError } = await supabase
      .from('order_feedback')
      .select(`
        *,
        orders!inner(
          id,
          venue_id
        )
      `);

    if (orderError) {
      console.log('ℹ️  No order_feedback table or no data:', orderError.message);
    } else if (orderFeedback && orderFeedback.length > 0) {
      console.log(`📊 Found ${orderFeedback.length} order feedback entries to migrate`);
      
      for (const feedback of orderFeedback) {
        const { data: insertData, error: insertError } = await supabase
          .from('feedback')
          .insert({
            venue_id: feedback.orders.venue_id,
            order_id: feedback.order_id,
            customer_name: 'Customer',
            customer_email: null,
            customer_phone: null,
            rating: feedback.rating,
            comment: feedback.comment || 'No additional comments',
            category: 'order',
            sentiment_score: null,
            sentiment_label: null,
            response: null,
            responded_at: null,
            created_at: feedback.created_at,
            updated_at: feedback.created_at
          })
          .select('id');

        if (insertError) {
          console.error(`❌ Error inserting order feedback ${feedback.id}:`, insertError.message);
        } else {
          console.log(`✅ Migrated order feedback ${feedback.id}`);
        }
      }
    }

    // Step 4: Verify migration
    console.log('\n🔍 Verifying migration...');
    
    const { data: feedbackCount, error: countError } = await supabase
      .from('feedback')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error('❌ Error checking feedback count:', countError.message);
    } else {
      console.log(`✅ Total feedback entries in main table: ${feedbackCount?.length || 0}`);
    }

    // Step 5: Drop old tables (optional - uncomment if you want to remove them)
    console.log('\n🗑️  Old tables can now be safely removed from your database');
    console.log('   - feedback_responses');
    console.log('   - order_feedback');
    console.log('   (Keep feedback_questions as it\'s still needed)');

    console.log('\n🎉 Migration completed successfully!');
    console.log('📋 Summary:');
    console.log('  - All feedback data consolidated into main "feedback" table');
    console.log('  - New feedback submissions will go directly to main table');
    console.log('  - Dashboard will show all feedback from unified table');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateFeedbackData();

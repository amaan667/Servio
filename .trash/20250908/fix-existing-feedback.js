const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExistingFeedback() {
  console.log('🔄 Fixing existing feedback data...');

  try {
    // Get all feedback entries that need fixing
    const { data: feedback, error: fetchError } = await supabase
      .from('feedback')
      .select('*')
      .is('sentiment_label', null);

    if (fetchError) {
      console.error('❌ Error fetching feedback:', fetchError.message);
      return;
    }

    if (!feedback || feedback.length === 0) {
      console.log('✅ No feedback entries need fixing');
      return;
    }

    console.log(`📊 Found ${feedback.length} feedback entries to fix`);

    // Fix each feedback entry
    for (const entry of feedback) {
      console.log(`\n🔧 Fixing feedback entry: ${entry.id}`);
      
      // Calculate sentiment based on rating
      let sentimentLabel = 'neutral';
      let sentimentScore = 0.5;
      
      if (entry.rating >= 4) {
        sentimentLabel = 'positive';
        sentimentScore = 0.8 + (entry.rating - 4) * 0.1;
      } else if (entry.rating <= 2) {
        sentimentLabel = 'negative';
        sentimentScore = 0.2 - (2 - entry.rating) * 0.1;
      }

      // Get customer name from order if available
      let customerName = entry.customer_name;
      if (entry.order_id && entry.customer_name === 'Customer') {
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('customer_name')
            .eq('id', entry.order_id)
            .single();
          
          if (orderData?.customer_name) {
            customerName = orderData.customer_name;
            console.log(`  📝 Found customer name: ${customerName}`);
          }
        } catch (error) {
          console.log(`  ⚠️  Could not fetch customer name: ${error.message}`);
        }
      }

      // Update the feedback entry
      const { error: updateError } = await supabase
        .from('feedback')
        .update({
          sentiment_label: sentimentLabel,
          sentiment_score: sentimentScore,
          customer_name: customerName,
          category: entry.category === 'structured' ? 'Customer Experience' : entry.category
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`❌ Error updating feedback ${entry.id}:`, updateError.message);
      } else {
        console.log(`✅ Updated feedback ${entry.id}:`);
        console.log(`   Rating: ${entry.rating} → Sentiment: ${sentimentLabel} (${sentimentScore})`);
        console.log(`   Customer: ${entry.customer_name} → ${customerName}`);
        console.log(`   Category: ${entry.category} → Customer Experience`);
      }
    }

    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    
    const { data: updatedFeedback, error: verifyError } = await supabase
      .from('feedback')
      .select('id, rating, sentiment_label, customer_name, category')
      .order('created_at', { ascending: false });

    if (verifyError) {
      console.error('❌ Error verifying fixes:', verifyError.message);
    } else {
      console.log('📊 Updated feedback entries:');
      updatedFeedback.forEach(entry => {
        console.log(`  ${entry.id}: ${entry.rating}⭐ → ${entry.sentiment_label} | ${entry.customer_name} | ${entry.category}`);
      });
    }

    console.log('\n🎉 Feedback fixes completed!');
    console.log('📋 Summary:');
    console.log('  - Sentiment analysis applied to existing feedback');
    console.log('  - Customer names updated from order data');
    console.log('  - Categories renamed to be more user-friendly');
    console.log('  - Dashboard should now show correct metrics');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixExistingFeedback();

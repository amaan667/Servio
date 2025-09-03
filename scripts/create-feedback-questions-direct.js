const { createClient } = require('@supabase/supabase-js');

async function createFeedbackQuestionsDirect() {
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
    console.log('🔧 Creating feedback_questions table...');
    
    // Create the feedback_questions table
    const { error: createError } = await supabase
      .from('feedback_questions')
      .select('id')
      .limit(1);
    
    if (createError && createError.message.includes('does not exist')) {
      console.log('📋 Table does not exist, creating it...');
      
      // We'll need to create it manually in Supabase dashboard
      console.log('💡 Please run this SQL in your Supabase SQL Editor:');
      console.log('');
      console.log('-- Create feedback_questions table');
      console.log('CREATE TABLE IF NOT EXISTS public.feedback_questions (');
      console.log('    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,');
      console.log('    venue_id TEXT NOT NULL,');
      console.log('    question TEXT NOT NULL,');
      console.log('    question_type TEXT NOT NULL CHECK (question_type IN (\'rating\', \'text\', \'multiple_choice\')),');
      console.log('    options TEXT[],');
      console.log('    active BOOLEAN DEFAULT true,');
      console.log('    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
      console.log('    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
      console.log(');');
      console.log('');
      console.log('-- Enable RLS');
      console.log('ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Create policy for venue owners');
      console.log('CREATE POLICY "Venue owners can manage their feedback questions" ON public.feedback_questions');
      console.log('    FOR ALL USING (');
      console.log('        venue_id IN (');
      console.log('            SELECT venue_id FROM public.venues WHERE owner_id = auth.uid()');
      console.log('        )');
      console.log('    );');
      console.log('');
      console.log('-- Grant permissions');
      console.log('GRANT ALL ON public.feedback_questions TO authenticated;');
      console.log('GRANT ALL ON public.feedback_questions TO service_role;');
      
    } else {
      console.log('✅ feedback_questions table already exists!');
    }

    console.log('');
    console.log('🔧 Creating feedback_responses table...');
    
    // Check if feedback_responses table exists
    const { error: responsesError } = await supabase
      .from('feedback_responses')
      .select('id')
      .limit(1);
    
    if (responsesError && responsesError.message.includes('does not exist')) {
      console.log('📋 Table does not exist, creating it...');
      
      console.log('💡 Please also run this SQL in your Supabase SQL Editor:');
      console.log('');
      console.log('-- Create feedback_responses table');
      console.log('CREATE TABLE IF NOT EXISTS public.feedback_responses (');
      console.log('    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,');
      console.log('    venue_id TEXT NOT NULL,');
      console.log('    question_id UUID NOT NULL,');
      console.log('    order_id UUID,');
      console.log('    response TEXT NOT NULL,');
      console.log('    rating INTEGER CHECK (rating >= 1 AND rating <= 5),');
      console.log('    customer_name TEXT,');
      console.log('    comments TEXT,');
      console.log('    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
      console.log(');');
      console.log('');
      console.log('-- Add foreign key constraint');
      console.log('ALTER TABLE public.feedback_responses');
      console.log('ADD CONSTRAINT fk_feedback_responses_question');
      console.log('FOREIGN KEY (question_id) REFERENCES public.feedback_questions(id) ON DELETE CASCADE;');
      console.log('');
      console.log('-- Enable RLS');
      console.log('ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Create policies');
      console.log('CREATE POLICY "Venue owners can view their feedback responses" ON public.feedback_responses');
      console.log('    FOR SELECT USING (');
      console.log('        venue_id IN (');
      console.log('            SELECT venue_id FROM public.venues WHERE owner_id = auth.uid()');
      console.log('        )');
      console.log('    );');
      console.log('');
      console.log('CREATE POLICY "Anyone can insert feedback responses" ON public.feedback_responses');
      console.log('    FOR INSERT WITH CHECK (true);');
      console.log('');
      console.log('-- Grant permissions');
      console.log('GRANT ALL ON public.feedback_responses TO authenticated;');
      console.log('GRANT ALL ON public.feedback_responses TO service_role;');
      
    } else {
      console.log('✅ feedback_responses table already exists!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createFeedbackQuestionsDirect();

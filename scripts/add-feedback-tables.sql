-- Create feedback_questions table
CREATE TABLE IF NOT EXISTS public.feedback_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id TEXT NOT NULL REFERENCES public.venues(venue_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'text', 'multiple_choice')),
    options TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback_responses table
CREATE TABLE IF NOT EXISTS public.feedback_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id TEXT NOT NULL REFERENCES public.venues(venue_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.feedback_questions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    response TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    customer_name TEXT,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_questions_venue_id ON public.feedback_questions(venue_id);
CREATE INDEX IF NOT EXISTS idx_feedback_questions_active ON public.feedback_questions(active);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_venue_id ON public.feedback_responses(venue_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_question_id ON public.feedback_responses(question_id);

-- Add RLS policies
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback_questions
CREATE POLICY "Venue owners can manage their feedback questions" ON public.feedback_questions
    FOR ALL USING (
        venue_id IN (
            SELECT venue_id FROM public.venues WHERE owner_id = auth.uid()
        )
    );

-- RLS policies for feedback_responses
CREATE POLICY "Venue owners can view their feedback responses" ON public.feedback_responses
    FOR SELECT USING (
        venue_id IN (
            SELECT venue_id FROM public.venues WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can insert feedback responses" ON public.feedback_responses
    FOR INSERT WITH CHECK (true);

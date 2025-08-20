-- Feedback questions authored by owners per venue
create table if not exists public.feedback_questions (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  prompt text not null check (char_length(prompt) between 4 and 160),
  type text not null check (type in ('stars','multiple_choice','paragraph')),
  choices jsonb null, -- array of strings when multiple_choice
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feedback_questions_venue on public.feedback_questions (venue_id, is_active, order_index);

-- Responses captured from customers
create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  order_id uuid null references public.orders(id) on delete set null,
  question_id uuid not null references public.feedback_questions(id) on delete cascade,
  answer_stars int null check (answer_stars between 1 and 5),
  answer_choice text null,
  answer_text text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_responses_venue on public.feedback_responses (venue_id, created_at desc);

-- RLS
alter table public.feedback_questions enable row level security;
alter table public.feedback_responses enable row level security;

-- Only venue owner can manage their questions; anyone can create response rows scoped to a venue.
do $$ begin
  create policy "owner can read/update questions" on public.feedback_questions
  for all using (exists (select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid()));
exception when others then null; end $$;

do $$ begin
  create policy "anon/any can insert responses" on public.feedback_responses
  for insert with check (true);
  create policy "owner can read responses" on public.feedback_responses
  for select using (exists (select 1 from public.venues v where v.venue_id = feedback_responses.venue_id and v.owner_id = auth.uid()));
exception when others then null; end $$;

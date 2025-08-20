-- Create a dedicated table for owner-defined questions and a simple order of appearance
create table if not exists public.feedback_questions (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  prompt text not null check (char_length(prompt) between 4 and 160),
  type text not null check (type in ('stars','multiple_choice','paragraph')),
  choices text[] default null,               -- required when type='multiple_choice'
  is_active boolean not null default true,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feedback_questions_venue on public.feedback_questions (venue_id, is_active, sort_index);

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

-- Policies: only venue owner can manage/read their questions
do $$
begin
  create policy "owner can select questions" on public.feedback_questions
  for select using (
    exists(select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid())
  );

  create policy "owner can modify questions" on public.feedback_questions
  for all using (
    exists(select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid())
  ) with check (
    exists(select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid())
  );
exception when others then null;
end $$;

-- Stripe webhook events table for idempotency and DLQ capture
create table if not exists public.stripe_webhook_events (
    id uuid primary key default gen_random_uuid(),
    event_id text not null unique,
    type text not null,
    status text not null default 'received' check (status in ('received', 'processing', 'succeeded', 'failed')),
    attempts integer not null default 0,
    last_error jsonb,
    payload jsonb,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_status_idx on public.stripe_webhook_events (status);
create index if not exists stripe_webhook_events_created_at_idx on public.stripe_webhook_events (created_at desc);

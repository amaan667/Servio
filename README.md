## Staff Management Setup

If you see "Could not find the table public.staff" in the app, run the SQL below in Supabase (SQL Editor) to create the table and RLS policy:

```
create extension if not exists pgcrypto;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues(venue_id) on delete cascade,
  name text not null,
  role text not null default 'Server',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

do $$ begin
  create policy "owner can manage staff" on public.staff
  for all using (
    exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
  ) with check (
    exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
  );
exception when others then null; end $$;
```

You can also find this in `scripts/staff-schema.sql`.

# Servio web design

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/amaantanveer667-4780s-projects/v0-servio-web-design)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/f98zgjA567C)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/amaantanveer667-4780s-projects/v0-servio-web-design](https://vercel.com/amaantanveer667-4780s-projects/v0-servio-web-design)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/f98zgjA567C](https://v0.dev/chat/projects/f98zgjA567C)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

# Trigger new deployment - Fri Jul 18 00:41:13 BST 2025

// Trigger redeploy Fri Jul 18 10:29:53 BST 2025
// redeploy Fri Jul 18 11:04:54 BST 2025
// redeploy Fri Jul 18 10:43:36 BST 2025
// redeploy Thu Aug 21 23:31:55 UTC 2025# Deployment trigger - Mon Aug 25 11:08:42 AM UTC 2025

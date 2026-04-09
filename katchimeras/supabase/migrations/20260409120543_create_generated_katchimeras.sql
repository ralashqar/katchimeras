create table if not exists public.generated_katchimeras (
  id uuid primary key default gen_random_uuid(),
  render_profile_id text not null,
  family_id text not null,
  habitat_aspect_id text not null,
  stage_id text not null,
  display_name text not null,
  model_id text not null default 'fal-ai/nano-banana-2',
  status text not null default 'queued' check (status in ('queued', 'generating', 'completed', 'failed')),
  prompt text not null,
  caption text,
  motivational_quote text,
  storage_bucket text,
  storage_path text,
  image_url text,
  fal_request_id text,
  error_message text,
  approved boolean not null default false,
  source_profile jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists generated_katchimeras_render_profile_id_idx
  on public.generated_katchimeras (render_profile_id);

create index if not exists generated_katchimeras_created_at_idx
  on public.generated_katchimeras (created_at desc);

alter table public.generated_katchimeras enable row level security;

drop policy if exists "public can read generated katchimeras" on public.generated_katchimeras;
create policy "public can read generated katchimeras"
  on public.generated_katchimeras
  for select
  using (true);

insert into storage.buckets (id, name, public)
values ('katchimera-art-dev', 'katchimera-art-dev', true)
on conflict (id) do update
set public = excluded.public;

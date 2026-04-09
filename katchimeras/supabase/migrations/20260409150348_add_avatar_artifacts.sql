create table if not exists public.player_avatar_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('global_asset', 'player')),
  owner_id text not null,
  avatar_kind text not null check (avatar_kind in ('hooded_default', 'selfie_avatar', 'selfie_variant', 'global_character_art')),
  source_kind text not null check (source_kind in ('prompt_only', 'selfie_input', 'selfie_plus_prompt')),
  status text not null default 'queued' check (status in ('queued', 'generating', 'completed', 'failed', 'approved', 'rejected')),
  display_name text not null,
  model_id text not null default 'fal-ai/nano-banana-2',
  prompt text not null,
  caption text,
  input_storage_bucket text,
  input_storage_path text,
  render_storage_bucket text,
  render_storage_path text,
  image_url text,
  error_message text,
  is_canonical boolean not null default false,
  source_profile jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists player_avatar_artifacts_owner_idx
  on public.player_avatar_artifacts (owner_kind, owner_id, avatar_kind, created_at desc);

create index if not exists player_avatar_artifacts_status_idx
  on public.player_avatar_artifacts (status, created_at desc);

create unique index if not exists player_avatar_artifacts_canonical_owner_kind_idx
  on public.player_avatar_artifacts (owner_kind, owner_id, avatar_kind)
  where is_canonical = true;

create table if not exists public.app_art_settings (
  key text primary key,
  current_artifact_id uuid references public.player_avatar_artifacts(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.player_avatar_artifacts enable row level security;
alter table public.app_art_settings enable row level security;

drop policy if exists "public can read player avatar artifacts" on public.player_avatar_artifacts;
create policy "public can read player avatar artifacts"
  on public.player_avatar_artifacts
  for select
  using (true);

drop policy if exists "public can insert player avatar artifacts" on public.player_avatar_artifacts;
create policy "public can insert player avatar artifacts"
  on public.player_avatar_artifacts
  for insert
  with check (true);

drop policy if exists "public can update player avatar artifacts" on public.player_avatar_artifacts;
create policy "public can update player avatar artifacts"
  on public.player_avatar_artifacts
  for update
  using (true)
  with check (true);

drop policy if exists "public can read app art settings" on public.app_art_settings;
create policy "public can read app art settings"
  on public.app_art_settings
  for select
  using (true);

drop policy if exists "public can insert app art settings" on public.app_art_settings;
create policy "public can insert app art settings"
  on public.app_art_settings
  for insert
  with check (true);

drop policy if exists "public can update app art settings" on public.app_art_settings;
create policy "public can update app art settings"
  on public.app_art_settings
  for update
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('avatar-inputs-private', 'avatar-inputs-private', false)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('avatar-renders-public', 'avatar-renders-public', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "public can upload avatar inputs" on storage.objects;
create policy "public can upload avatar inputs"
  on storage.objects
  for insert
  with check (bucket_id = 'avatar-inputs-private');

drop policy if exists "public can read avatar renders" on storage.objects;
create policy "public can read avatar renders"
  on storage.objects
  for select
  using (bucket_id = 'avatar-renders-public');

insert into public.app_art_settings (key, current_artifact_id)
values ('default_hooded_avatar', null)
on conflict (key) do nothing;

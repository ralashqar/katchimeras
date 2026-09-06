create schema if not exists private;

create table public.art_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  asset_type text not null check (
    asset_type in (
      'creature_cutout',
      'hatchling',
      'resident_hex_tile',
      'resident_environment',
      'expression_grid',
      'other'
    )
  ),
  aspect_id text,
  skin_id text,
  pipeline_version text not null,
  status text not null default 'candidate' check (
    status in ('candidate', 'kept', 'approved', 'promoted', 'retired', 'failed')
  ),
  model_id text,
  prompt_hash text,
  source_hash text,
  storage_bucket text,
  storage_path text,
  bundled_path text,
  generation_record_id uuid references public.generated_katchimeras(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  runtime_enabled_at timestamptz,
  constraint art_assets_identity_present check (
    asset_type = 'other' or aspect_id is not null or skin_id is not null
  ),
  constraint art_assets_storage_pair check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  )
);

comment on table public.art_assets is
  'Registry of generated and bundled Katchimera art. Life aspect is logical identity; skin is presentation.';
comment on column public.art_assets.asset_key is
  'Stable pipeline/runtime key, independent of a generation attempt id.';
comment on column public.art_assets.bundled_path is
  'Repository-relative promoted asset path when the asset ships with the app.';

create index art_assets_aspect_type_idx
  on public.art_assets (aspect_id, asset_type, status);
create index art_assets_skin_type_idx
  on public.art_assets (skin_id, asset_type, status);
create index art_assets_generation_record_idx
  on public.art_assets (generation_record_id)
  where generation_record_id is not null;

create or replace function private.set_art_assets_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_art_assets_updated_at
before update on public.art_assets
for each row execute function private.set_art_assets_updated_at();

alter table public.art_assets enable row level security;

-- The registry is an internal art-production ledger. Edge Functions use the
-- service role (which bypasses RLS); mobile clients receive no direct table
-- privileges and must go through an authorized function.
revoke all on table public.art_assets from anon, authenticated;

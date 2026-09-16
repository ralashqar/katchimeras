-- Content packs: live-ops content (a hex tile and its art, a character, a merge chain, a mission
-- board, a chapter) published as one JSON manifest plus art in a public bucket. The app asks for the
-- newest enabled pack its version can play; the manifest is validated whole on the device before
-- anything is registered. Modelled on economy_live_config. Idempotent: it was first applied by hand
-- with `supabase db query`, ahead of the older pending migrations, and may run again under `db push`.

create table if not exists public.content_packs (
  id text not null,
  version integer not null check (version > 0),
  content_schema_version integer not null check (content_schema_version > 0),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  enabled boolean not null default false,
  min_app_version text,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz not null default now(),
  primary key (id, version)
);

alter table public.content_packs enable row level security;
-- No direct reads: the app goes through the function below, which applies the window and version gates.

-- Art lives in a public bucket under <packId>/<version>/<file>; the manifest names each file's url, size and md5.
insert into storage.buckets (id, name, public)
values ('content-pack-art', 'content-pack-art', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'content pack art is public') then
    create policy "content pack art is public" on storage.objects
      for select using (bucket_id = 'content-pack-art');
  end if;
end
$$;

-- The newest enabled pack this app may play: in its window, its schema readable, its minimum app version met.
create or replace function public.get_content_pack_v1(app_version text, schema_version integer)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'version', p.version,
    'publishedAt', p.published_at,
    'pack', p.manifest
  )
  from public.content_packs p
  where p.enabled
    and p.content_schema_version <= schema_version
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
    and (
      p.min_app_version is null
      or string_to_array(p.min_app_version, '.')::int[] <= string_to_array(app_version, '.')::int[]
    )
  order by p.published_at desc, p.version desc
  limit 1;
$$;

revoke all on function public.get_content_pack_v1(text, integer) from public;
grant execute on function public.get_content_pack_v1(text, integer) to authenticated, anon;

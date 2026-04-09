alter table public.generated_katchimeras
  alter column family_id drop not null,
  alter column habitat_aspect_id drop not null,
  alter column stage_id drop not null;

alter table public.generated_katchimeras
  add column if not exists top_level_type text,
  add column if not exists trigger_category text,
  add column if not exists trigger_subtype text,
  add column if not exists theme text,
  add column if not exists creature_kind text;

create index if not exists generated_katchimeras_top_level_type_idx
  on public.generated_katchimeras (top_level_type);

create index if not exists generated_katchimeras_trigger_subtype_idx
  on public.generated_katchimeras (trigger_subtype);

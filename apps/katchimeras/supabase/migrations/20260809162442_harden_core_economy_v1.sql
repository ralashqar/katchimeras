-- Private helpers are callable only through the authenticated public RPCs.
revoke usage on schema private from anon, authenticated;
revoke execute on all functions in schema private from anon, authenticated, public;

alter table public.economy_reward_rules
  add column if not exists daily_limit integer check (daily_limit is null or daily_limit > 0),
  add column if not exists ordinary_daily_cap_exempt boolean not null default false;

create table if not exists public.economy_avatar_catalog (
  collectible_id text primary key,
  category text not null check (category in ('body','face','hat','held')),
  item_id text not null,
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  enabled boolean not null default false,
  unique (category, item_id)
);
alter table public.economy_avatar_catalog enable row level security;
create policy "Authenticated users read enabled avatar economy catalog" on public.economy_avatar_catalog
  for select to authenticated using (enabled);

insert into public.economy_avatar_catalog (collectible_id, category, item_id, rarity, enabled) values
  ('body:strawberry-cream','body','strawberry-cream','common',false),
  ('body:matcha-marble','body','matcha-marble','rare',false),
  ('body:rose-quartz','body','rose-quartz','rare',false),
  ('body:sunny-raincoat','body','sunny-raincoat','common',false),
  ('body:toadstool-speckle','body','toadstool-speckle','rare',false),
  ('body:coral-cove','body','coral-cove','rare',false),
  ('body:knight-tunic','body','knight-tunic','rare',false),
  ('body:penguin-tux','body','penguin-tux','common',false),
  ('body:party-outfit','body','party-outfit','rare',false),
  ('body:storybook-ink','body','storybook-ink','epic',false),
  ('body:chef-apron','body','chef-apron','common',false),
  ('body:garden-overalls','body','garden-overalls','common',false),
  ('body:detective-coat','body','detective-coat','rare',false),
  ('body:pirate-coat','body','pirate-coat','rare',false),
  ('body:ballet-wrap','body','ballet-wrap','rare',false),
  ('face:starry-eyed','face','starry-eyed','rare',false),
  ('face:sparkle-awe','face','sparkle-awe','rare',false),
  ('face:bashful-smile','face','bashful-smile','common',false),
  ('face:tiny-giggle','face','tiny-giggle','common',false),
  ('face:grumpy-cute','face','grumpy-cute','rare',false),
  ('face:big-surprise','face','big-surprise','common',false),
  ('face:dizzy-swirls','face','dizzy-swirls','epic',false),
  ('face:mischief','face','mischief','rare',false),
  ('face:laser-focus','face','laser-focus','rare',false),
  ('face:sleepy-yawn','face','sleepy-yawn','common',false),
  ('face:tongue-out','face','tongue-out','rare',false),
  ('face:kissy-face','face','kissy-face','rare',false),
  ('hat:mushroom-cap','hat','mushroom-cap','rare',false),
  ('hat:party-cone','hat','party-cone','common',false),
  ('hat:chef-toque','hat','chef-toque','common',false),
  ('hat:sailor-cap','hat','sailor-cap','rare',false),
  ('hat:explorer-cap','hat','explorer-cap','rare',false),
  ('hat:moon-bonnet','hat','moon-bonnet','rare',false),
  ('hat:pancake-stack','hat','pancake-stack','rare',false),
  ('hat:strawberry-topper','hat','strawberry-topper','common',false),
  ('hat:blueberry-cap','hat','blueberry-cap','common',false),
  ('hat:watermelon-visor','hat','watermelon-visor','common',false),
  ('hat:frog-hood','hat','frog-hood','rare',false),
  ('hat:bunny-ears','hat','bunny-ears','common',false),
  ('hat:dino-spikes','hat','dino-spikes','rare',false),
  ('hat:knight-circlet','hat','knight-circlet','rare',false),
  ('hat:pirate-tricorn','hat','pirate-tricorn','epic',false),
  ('hat:graduation-cap','hat','graduation-cap','rare',false),
  ('hat:cozy-headphones','hat','cozy-headphones','rare',false),
  ('hat:woodland-antlers','hat','woodland-antlers','epic',false),
  ('hat:snowflake-tiara','hat','snowflake-tiara','epic',false),
  ('hat:blossom-crown','hat','blossom-crown','epic',false),
  ('held:watering-can','held','watering-can','common',false),
  ('held:magnifying-glass','held','magnifying-glass','rare',false),
  ('held:berry-lollipop','held','berry-lollipop','common',false),
  ('held:little-guitar','held','little-guitar','rare',false),
  ('held:seashell','held','seashell','common',false),
  ('held:snow-globe','held','snow-globe','epic',false),
  ('held:picnic-basket','held','picnic-basket','rare',false),
  ('held:flower-balloon','held','flower-balloon','rare',false)
on conflict (collectible_id) do update set rarity = excluded.rarity;

create or replace function private.purchase_avatar_collectible_v1(target_category text, target_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.economy_avatar_catalog%rowtype;
  v_balance integer;
  v_price integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.economy_avatar_catalog where category = target_category and item_id = target_item_id and enabled for update;
  if v_item.collectible_id is null then raise exception 'Invalid offer'; end if;
  if exists (select 1 from public.economy_collectible_grants where user_id = v_user_id and collectible_type = 'avatar' and collectible_id = v_item.collectible_id and revoked_at is null) then return jsonb_build_object('ok', true, 'idempotent', true); end if;
  v_price := case v_item.category
    when 'body' then case v_item.rarity when 'common' then 150 when 'rare' then 300 when 'epic' then 500 else 900 end
    when 'face' then case v_item.rarity when 'common' then 60 when 'rare' then 120 when 'epic' then 240 else 450 end
    else case v_item.rarity when 'common' then 80 when 'rare' then 160 when 'epic' then 320 else 600 end
  end;
  select coalesce(sum(delta), 0)::integer into v_balance from public.economy_essence_ledger where user_id = v_user_id;
  if v_balance < v_price then raise exception 'Insufficient Essence'; end if;
  insert into public.economy_essence_ledger (user_id, delta, reason, source_type, rule_version, idempotency_key)
  values (v_user_id, -v_price, 'avatar_purchase', 'avatar', 1, 'avatar:' || v_item.collectible_id);
  perform private.economy_grant_v1(v_user_id, 'avatar', v_item.collectible_id, 'avatar_essence', 'avatar:' || v_item.collectible_id);
  return jsonb_build_object('ok', true, 'price', v_price);
end;
$$;

create or replace function public.purchase_avatar_collectible_v1(category text, item_id text) returns jsonb language sql security invoker set search_path = '' as $$ select private.purchase_avatar_collectible_v1(category, item_id); $$;
revoke all on function public.purchase_avatar_collectible_v1(text, text) from public, anon;
grant execute on function public.purchase_avatar_collectible_v1(text, text) to authenticated;

create or replace function private.ensure_visitor_offer_v1()
returns public.economy_visitor_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign public.economy_campaigns%rowtype;
  v_captured integer;
  v_claim_index integer;
  v_pool text[];
  v_choices text[];
  v_fallback integer;
  v_row public.economy_visitor_claims%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_campaign from public.economy_campaigns
  where kind = 'visitor' and enabled and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  order by priority desc, id limit 1;
  if v_campaign.id is null then return null; end if;
  select count(*)::integer into v_captured from public.streak_days where user_id = v_user_id and state = 'captured';
  v_claim_index := floor(v_captured / greatest(1, coalesce((v_campaign.config->>'daysPerClaim')::integer, 7)))::integer - 1;
  if v_claim_index < 0 then return null; end if;
  select * into v_row from public.economy_visitor_claims where user_id = v_user_id and claim_index = v_claim_index;
  if v_row.user_id is not null then return v_row; end if;
  select coalesce(array_agg(value), '{}'::text[]) into v_pool from jsonb_array_elements_text(coalesce(v_campaign.config->'pool', '[]'::jsonb)) value;
  select coalesce(array_agg(candidate order by digest), '{}'::text[]) into v_choices from (
    select candidate, md5(v_user_id::text || ':' || v_claim_index::text || ':' || candidate) digest
    from unnest(v_pool) candidate
    where not exists (
      select 1 from public.economy_collectible_grants grant_row
      where grant_row.user_id = v_user_id and grant_row.collectible_type = 'wisp' and grant_row.collectible_id = candidate and grant_row.revoked_at is null
    ) order by digest limit greatest(1, least(coalesce((v_campaign.config->>'choiceCount')::integer, 3), 3))
  ) ranked;
  v_fallback := greatest(0, coalesce((v_campaign.config->>'ownedPoolFallbackEssence')::integer, 150));
  insert into public.economy_visitor_claims (user_id, claim_index, campaign_id, earned_at_captured_days, choices, claimed_at)
  values (
    v_user_id,
    v_claim_index,
    v_campaign.id,
    (v_claim_index + 1) * coalesce((v_campaign.config->>'daysPerClaim')::integer, 7),
    v_choices,
    case when cardinality(v_choices) = 0 then now() else null end
  ) returning * into v_row;
  if cardinality(v_choices) = 0 and v_fallback > 0 then
    insert into public.economy_essence_ledger (user_id, delta, reason, source_type, rule_version, idempotency_key)
    values (v_user_id, v_fallback, 'visitor_pool_complete', 'visitor', 1, 'visitor-fallback:' || v_campaign.id || ':' || v_claim_index)
    on conflict (user_id, idempotency_key) do nothing;
  end if;
  return v_row;
end;
$$;

create or replace function private.register_economy_event_v1(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_event_id text := payload->>'client_event_id';
  v_event_type text := payload->>'event_type';
  v_local_date date := (payload->>'local_date')::date;
  v_source_hash text := payload->>'source_id_hash';
  v_occurred_at timestamptz := (payload->>'occurred_at')::timestamptz;
  v_rule public.economy_reward_rules%rowtype;
  v_inserted integer;
  v_type_count integer;
  v_ordinary_earned integer;
  v_delta integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_client_event_id is null or length(v_client_event_id) > 160 or v_event_type is null or v_source_hash is null or length(v_source_hash) > 128 or v_occurred_at is null then raise exception 'Invalid economy event'; end if;
  if v_local_date < current_date - 7 or v_local_date > current_date + 1 then raise exception 'Invalid economy event date'; end if;
  if v_event_type not in ('photo', 'voice', 'reflection', 'place', 'new_place', 'food', 'studio', 'big_moment', 'quest', 'hatched_week', 'discovery_common', 'discovery_rare', 'discovery_epic', 'discovery_legendary') then raise exception 'Unsupported economy event'; end if;

  select * into v_rule from public.economy_reward_rules where event_type = v_event_type and enabled
    and (starts_at is null or starts_at <= v_occurred_at) and (ends_at is null or ends_at > v_occurred_at)
    order by rule_version desc limit 1;
  if v_rule.event_type is null then return jsonb_build_object('credited', false, 'reason', 'rule_disabled'); end if;

  select count(*)::integer into v_type_count from public.economy_event_receipts
  where user_id = v_user_id and event_type = v_event_type and local_date = v_local_date;
  if v_rule.daily_limit is not null and v_type_count >= v_rule.daily_limit then
    return jsonb_build_object('credited', false, 'reason', 'daily_type_cap');
  end if;

  insert into public.economy_event_receipts (user_id, client_event_id, event_type, local_date, source_id_hash, occurred_at, rule_version)
  values (v_user_id, v_client_event_id, v_event_type, v_local_date, v_source_hash, v_occurred_at, v_rule.rule_version)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('credited', false, 'reason', 'duplicate'); end if;

  v_delta := v_rule.essence_delta;
  if not v_rule.ordinary_daily_cap_exempt then
    select coalesce(sum(ledger.delta), 0)::integer into v_ordinary_earned
    from public.economy_essence_ledger ledger
    join public.economy_event_receipts receipt
      on receipt.user_id = ledger.user_id and ledger.idempotency_key = 'event:' || receipt.client_event_id
    join public.economy_reward_rules rule
      on rule.event_type = receipt.event_type and rule.rule_version = receipt.rule_version
    where ledger.user_id = v_user_id and receipt.local_date = v_local_date and not rule.ordinary_daily_cap_exempt and ledger.delta > 0;
    v_delta := least(v_delta, greatest(0, 20 - v_ordinary_earned));
  end if;
  if v_delta <= 0 then return jsonb_build_object('credited', false, 'reason', 'ordinary_daily_cap'); end if;

  insert into public.economy_essence_ledger (user_id, delta, reason, source_type, source_id_hash, rule_version, idempotency_key, occurred_at)
  values (v_user_id, v_delta, 'captured_life', v_event_type, v_source_hash, v_rule.rule_version, 'event:' || v_client_event_id, v_occurred_at);
  return jsonb_build_object('credited', true, 'delta', v_delta, 'ruleVersion', v_rule.rule_version);
end;
$$;

create or replace function private.get_economy_snapshot_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config jsonb;
  v_visitor public.economy_visitor_claims%rowtype;
  v_plus boolean;
  v_shop_slots integer;
  v_shop_ids jsonb;
  v_period text := to_char(now() at time zone 'UTC', 'YYYY-MM');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_visitor := private.ensure_visitor_offer_v1();
  select payload into v_config from public.economy_live_config where id = 'default' and enabled
    and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now());
  v_plus := exists (select 1 from public.economy_subscriptions where user_id = v_user_id and active and (expires_at is null or expires_at > now()));
  v_shop_slots := case when v_plus then 6 else 3 end;
  select coalesce(jsonb_agg(id order by digest), '[]'::jsonb) into v_shop_ids from (
    select offer.id, md5(v_user_id::text || ':' || current_date::text || ':' || offer.id) digest
    from public.economy_offers offer
    join public.economy_campaigns campaign on campaign.id = offer.campaign_id
    where campaign.kind = 'shop' and campaign.enabled and offer.enabled and offer.currency = 'essence'
      and (campaign.starts_at is null or campaign.starts_at <= now()) and (campaign.ends_at is null or campaign.ends_at > now())
      and (offer.starts_at is null or offer.starts_at <= now()) and (offer.ends_at is null or offer.ends_at > now())
    order by digest limit v_shop_slots
  ) ranked;
  v_config := jsonb_set(
    v_config,
    '{shop,offers}',
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', offer.id,
      'collectibleType', offer.collectible_type,
      'collectibleId', offer.collectible_id,
      'currency', offer.currency,
      'price', offer.price,
      'enabled', offer.enabled,
      'startsAt', offer.starts_at,
      'endsAt', offer.ends_at
    ) order by offer.id) from public.economy_offers offer where offer.enabled), '[]'::jsonb),
    true
  );
  return jsonb_build_object(
    'config', v_config,
    'snapshot', jsonb_build_object(
      'configVersion', coalesce((v_config->>'version')::integer, 1),
      'serverTime', now(),
      'essenceBalance', (select coalesce(sum(delta), 0) from public.economy_essence_ledger where user_id = v_user_id),
      'activePlus', v_plus,
      'inventory', coalesce((select jsonb_agg(jsonb_build_object('collectibleType', collectible_type, 'collectibleId', collectible_id, 'quantity', quantity, 'source', source, 'grantedAt', granted_at)) from public.economy_collectible_grants where user_id = v_user_id and revoked_at is null), '[]'::jsonb),
      'activeCampaignIds', coalesce((select jsonb_agg(id order by priority desc, id) from public.economy_campaigns where enabled and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())), '[]'::jsonb),
      'shopOfferIds', v_shop_ids,
      'visitorOffer', case when v_visitor.user_id is null or v_visitor.claimed_at is not null then null else jsonb_build_object('claimIndex', v_visitor.claim_index, 'choices', v_visitor.choices, 'earnedAtCapturedDays', v_visitor.earned_at_captured_days) end,
      'monthlyPlusClaimed', exists (select 1 from public.economy_collectible_grants where user_id = v_user_id and source_key = 'plus:' || v_period and revoked_at is null),
      'synced', true
    )
  );
end;
$$;

create or replace function public.get_economy_snapshot_v1() returns jsonb language sql security invoker set search_path = '' as $$ select private.get_economy_snapshot_v1(); $$;
create or replace function public.purchase_economy_offer_v1(offer_id text) returns jsonb language sql security invoker set search_path = '' as $$ select private.purchase_economy_offer_v1(offer_id); $$;
create or replace function public.register_economy_event_v1(payload jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.register_economy_event_v1(payload); $$;
create or replace function public.migrate_legacy_economy_v1(opening_balance integer, purchased_avatar_ids text[], equipped_avatar_ids text[]) returns jsonb language sql security invoker set search_path = '' as $$ select private.migrate_legacy_economy_v1(opening_balance, purchased_avatar_ids, equipped_avatar_ids); $$;
create or replace function public.choose_visitor_wisp_v1(chosen_wisp_id text) returns jsonb language sql security invoker set search_path = '' as $$ select private.choose_visitor_wisp_v1(chosen_wisp_id); $$;
create or replace function public.claim_monthly_plus_wisp_v1() returns jsonb language sql security invoker set search_path = '' as $$ select private.claim_monthly_plus_wisp_v1(); $$;

update public.economy_live_config set version = 2, catalog_version = 3, payload = jsonb_build_object(
  'version', 2,
  'catalogVersion', 3,
  'flags', coalesce(payload->'flags', '{}'::jsonb),
  'essence', jsonb_build_object(
    'purchasable', false,
    'duplicateConversion', jsonb_build_object('common', 25, 'rare', 50, 'epic', 90, 'legendary', 160),
    'avatarPrices', jsonb_build_object(
      'body', jsonb_build_object('common',150,'rare',300,'epic',500,'legendary',900),
      'face', jsonb_build_object('common',60,'rare',120,'epic',240,'legendary',450),
      'hat', jsonb_build_object('common',80,'rare',160,'epic',320,'legendary',600),
      'held', jsonb_build_object('common',80,'rare',160,'epic',320,'legendary',600)
    ),
    'rewards', jsonb_build_object('photo', 5, 'voice', 6, 'reflection', 4, 'place', 5, 'newPlaceBonus', 3, 'food', 4, 'studio', 4, 'bigMoment', 10, 'quest', 8, 'hatchedWeek', 25)
  ),
  'shop', jsonb_build_object('freeSlots', 3, 'plusSlots', 6, 'offers', '[]'::jsonb),
  'visitor', jsonb_build_object('daysPerClaim', 7, 'choiceCount', 3, 'ownedPoolFallbackEssence', 150, 'pool', jsonb_build_array('dewdrop','bubble','nimbus','clover','pebble','crystal'), 'enabled', false),
  'plus', jsonb_build_object('entitlementId', 'plus', 'offeringId', 'default', 'products', jsonb_build_array('katchimeras_plus_monthly','katchimeras_plus_annual'), 'monthlyClaimWispId', 'opal', 'enabled', false, 'capabilities', jsonb_build_object('historyDays', null, 'premiumAvatarRental', true, 'shopSlots', 6, 'monthlyWispClaim', true))
) where id = 'default';

insert into public.economy_reward_rules (event_type, rule_version, essence_delta, enabled, daily_limit, ordinary_daily_cap_exempt) values
  ('photo', 2, 5, false, 2, false),
  ('voice', 2, 6, false, 1, false),
  ('reflection', 2, 4, false, 1, false),
  ('place', 2, 5, false, null, false),
  ('new_place', 2, 3, false, null, false),
  ('food', 2, 4, false, 1, false),
  ('studio', 2, 4, false, 1, false),
  ('big_moment', 2, 10, false, 1, false),
  ('quest', 2, 8, false, 1, false),
  ('hatched_week', 2, 25, false, null, true),
  ('discovery_common', 2, 20, false, null, true),
  ('discovery_rare', 2, 40, false, null, true),
  ('discovery_epic', 2, 70, false, null, true),
  ('discovery_legendary', 2, 100, false, null, true)
on conflict (event_type, rule_version) do update set essence_delta = excluded.essence_delta, daily_limit = excluded.daily_limit, ordinary_daily_cap_exempt = excluded.ordinary_daily_cap_exempt;

insert into public.economy_offers (id, campaign_id, collectible_type, collectible_id, currency, price, enabled) values
  ('shop-orbit', 'shop-pilot', 'wisp', 'orbit', 'essence', 800, false),
  ('shop-dewdrop', 'shop-pilot', 'wisp', 'dewdrop', 'essence', 300, false),
  ('shop-bubble', 'shop-pilot', 'wisp', 'bubble', 'essence', 300, false),
  ('shop-quill', 'shop-pilot', 'wisp', 'quill', 'essence', 500, false),
  ('shop-nimbus', 'shop-pilot', 'wisp', 'nimbus', 'essence', 500, false),
  ('shop-clover', 'shop-pilot', 'wisp', 'clover', 'essence', 300, false),
  ('shop-pebble', 'shop-pilot', 'wisp', 'pebble', 'essence', 300, false),
  ('shop-crystal', 'shop-pilot', 'wisp', 'crystal', 'essence', 800, false)
on conflict (id) do update set price = excluded.price;

revoke execute on function private.register_economy_event_v1(jsonb) from anon, authenticated, public;
revoke execute on function private.ensure_visitor_offer_v1() from anon, authenticated, public;
revoke execute on function private.purchase_economy_offer_v1(text) from anon, authenticated, public;
revoke execute on function private.migrate_legacy_economy_v1(integer, text[], text[]) from anon, authenticated, public;
revoke execute on function private.choose_visitor_wisp_v1(text) from anon, authenticated, public;
revoke execute on function private.claim_monthly_plus_wisp_v1() from anon, authenticated, public;
revoke execute on function private.purchase_avatar_collectible_v1(text, text) from anon, authenticated, public;
revoke execute on function private.get_economy_snapshot_v1() from anon, authenticated, public;

grant usage on schema private to authenticated;
grant execute on function private.get_economy_snapshot_v1() to authenticated;
grant execute on function private.ensure_visitor_offer_v1() to authenticated;
grant execute on function private.purchase_economy_offer_v1(text) to authenticated;
grant execute on function private.register_economy_event_v1(jsonb) to authenticated;
grant execute on function private.migrate_legacy_economy_v1(integer, text[], text[]) to authenticated;
grant execute on function private.choose_visitor_wisp_v1(text) to authenticated;
grant execute on function private.claim_monthly_plus_wisp_v1() to authenticated;
grant execute on function private.purchase_avatar_collectible_v1(text, text) to authenticated;

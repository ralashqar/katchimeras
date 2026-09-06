# Supabase Working Guide

This document is for future work in this repo. It is not a generic Supabase tutorial. It describes how Katchimeras works today, where Supabase is actually in use, and which shortcuts are safe only for internal development.

## Current App Behavior

Related product reference:

- `docs/katchimera-app-mvp-design.md`
- `docs/home-screen-ux-and-katchimera-design-system.md`
- `docs/mvp-implementation-plan.md`

### User flow today

The core app is still a local-first prototype:

1. The tabs layout redirects to `/onboarding` until the device-local onboarding profile is marked complete.
2. The onboarding flow is a fixed pager:
   - cinematic intro
   - aspiration question
   - pain-point question
   - world-tone question
   - processing screen
   - starter reveal
   - premium preview
3. Completing onboarding writes a local JSON payload under `katchadeck.onboarding-profile`.
4. The `Reveal` and `World` tabs render from local onboarding answers plus demo constants.
5. The premium modal is a placeholder only. Billing is not wired.

Important: onboarding, timeline state, premium access, and user identity are not backed by Supabase yet.

### What Supabase is used for today

Supabase currently powers the art tooling, not the main consumer flow:

- `utils/supabase.ts`
  - Creates the Expo client.
  - Uses `expo-sqlite/localStorage/install` and `localStorage` session persistence.
  - Reads `EXPO_PUBLIC_SUPABASE_URL`.
  - Reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with a fallback to `EXPO_PUBLIC_SUPABASE_KEY`.
- `/art-lab`
  - `KatchimeraStudio` reads `generated_katchimeras` and invokes `generate-katchimera-art`.
  - `AvatarStudio` uploads selfie input to Storage, reads and updates `player_avatar_artifacts`, updates `app_art_settings`, and invokes `generate-player-avatar`.

## Current Supabase Setup

### Verified local state on 2026-04-12

- Supabase CLI version: `2.89.1`
- Linked hosted project:
  - project ref: `ecwlxvidbrvatqtyttpw`
  - project name: `Katchimeras`
  - region: `West EU (Paris)`
- `npx supabase projects list` works in this repo.
- `npx supabase status` failed because the local Docker-backed stack is not running on this machine.

This means remote access is available, but local Supabase services are not currently up.

### Environment variables

The repo currently contains `.env.local` with:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

The client code also supports:

- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Rule: treat `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the canonical name going forward. Keep the fallback only for compatibility until the repo is cleaned up.

Rule: never put `service_role` or any secret key in Expo client code or `EXPO_PUBLIC_*` variables.

### Database objects in this repo

Tables defined in migrations:

- `public.todos`
  - Starter table from the initial example.
  - Seeded by `supabase/seed.sql`.
  - Not used by the app.
- `public.generated_katchimeras`
  - Stores generated creature art metadata and result payloads.
  - Read by the app.
  - Written by the `generate-katchimera-art` Edge Function through the service role.
- `public.player_avatar_artifacts`
  - Stores generated avatar metadata, status, storage paths, and canonical flags.
  - Read and updated directly by the app today.
- `public.app_art_settings`
  - Stores the current global default avatar selection.
  - Read and updated directly by the app today.

Storage buckets created by migrations:

- `katchimera-art-dev`
  - Public bucket for generated Katchimera art.
- `avatar-inputs-private`
  - Private bucket for raw selfie uploads.
- `avatar-renders-public`
  - Public bucket for rendered avatars.

Edge Functions:

- `generate-katchimera-art`
  - Inserts a `generated_katchimeras` row.
  - Calls FAL.
  - Uploads the rendered image to `katchimera-art-dev`.
  - Updates the row with the public URL and payload.
- `generate-player-avatar`
  - Inserts a `player_avatar_artifacts` row.
  - Optionally signs a private selfie input URL.
  - Calls FAL.
  - Uploads the rendered image to `avatar-renders-public`.
  - Updates the row with the public URL and payload.

Required function secret:

- `FAL_KEY`

The functions also depend on Supabase-provided environment values such as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Repo-Specific Pitfalls

### 1. The pasted sample guide is close, but not the same as this repo

Do not blindly copy the sample setup into this app.

Differences that matter here:

- The repo uses Expo localStorage via `expo-sqlite/localStorage/install`, not AsyncStorage.
- The repo is an Expo Router app, not a single-file `App.tsx` example.
- The repo already has a linked Supabase project, migrations, buckets, and Edge Functions.
- The repo should prefer `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, even though the old `EXPO_PUBLIC_SUPABASE_KEY` fallback still works.

### 2. Onboarding is local-only

The onboarding flow feels product-shaped, but the data model is still device-local.

That means:

- no server persistence
- no account linkage
- no cross-device restore
- no RLS-backed ownership model
- no subscription entitlements

Do not build future features under the assumption that onboarding answers already exist in Supabase. They do not.

### 3. The art functions are currently public-cost endpoints

Both functions are configured with `verify_jwt = false` in `supabase/config.toml`.

Combined with:

- open CORS (`Access-Control-Allow-Origin: *`)
- Expo client usage from a public app
- paid third-party generation behind the function

this means the current function endpoints should be treated as public unless you add your own authorization inside the function.

This is acceptable only for internal tooling or tightly controlled testing. It is not a safe production default for cost-bearing generation endpoints.

### 4. Avatar table policies are far too open for production

`player_avatar_artifacts` currently allows public `select`, `insert`, and `update`.

`app_art_settings` currently allows public `select`, `insert`, and `update`.

Practical consequence:

- any client can mark rows canonical
- any client can alter status fields
- any client can overwrite the global default avatar setting
- there is no owner check

This is the single biggest Supabase risk in the current schema.

### 5. Client-generated player ids are test ids, not identities

`getOrCreateLocalTestPlayerId()` creates a local random id and stores it on device.

That id is useful for dev-only asset experiments. It is not a secure identity primitive and must not be used as the basis for RLS or account ownership.

If onboarding or avatars become real user features, switch to a real auth-backed user id first.

### 6. Public buckets are only for assets that can truly be public

`katchimera-art-dev` and `avatar-renders-public` both expose public URLs.

Anything uploaded there should be considered publicly retrievable.

Do not place any of the following in public buckets:

- paid-only assets
- private user uploads
- personal profile photos in original form
- anything that should require authorization later

The current private bucket pattern is only used for selfie inputs, which is the correct direction.

### 7. The canonical-avatar flow is not transactional

`setAvatarCanonical()` does two separate updates:

1. clear the current canonical row
2. set the target row as canonical

There is a partial unique index on canonical rows, which helps, but the app-side two-step flow is still race-prone once multiple devices or users can act at the same time.

If this becomes a real user-facing feature, move the canonical switch into SQL or an Edge Function so it executes atomically.

### 8. Storage policy behavior changes if you use `upsert`

The current avatar input upload uses `upsert: false`, so an insert-only policy is enough for that exact path.

If a future implementation switches to `upsert: true`, Supabase Storage will also need `SELECT` and `UPDATE` permission on `storage.objects`.

Do not forget this. It is a common silent failure mode.

### 9. Keep starter artifacts from leaking into product assumptions

The repo still contains:

- `public.todos`
- `supabase/seed.sql`

These are starter artifacts, not part of the app model.

Either remove them later or keep them clearly identified as non-product schema.

## Safe Workflow For Future Supabase Work

### When adding a new app feature

Start by deciding which of these three categories the feature belongs to:

1. local-only prototype state
2. authenticated user data
3. internal admin or art-tooling workflow

Do not mix these categories casually. Most Supabase mistakes in this repo will come from promoting local prototype flows into real data flows without changing the security model.

### When adding or changing schema

Use this workflow:

1. Create a migration file with `npx supabase migration new <name>`.
2. Write SQL in `supabase/migrations/...`.
3. If local Docker is available, run the local stack and test against it.
4. Verify table policies, storage policies, and bucket visibility before wiring app code.
5. Keep writes that require privilege inside an Edge Function or trusted server context.

Rules:

- Enable RLS on every exposed table immediately.
- Do not use `using (true)` or `with check (true)` as a production placeholder on user tables.
- If a table supports updates, remember that Postgres RLS updates also need a matching `SELECT` policy.
- Do not put privileged `security definer` functions in an exposed schema.

### When changing Edge Functions

Use this workflow:

1. Decide whether the function is public, authenticated, or internal-only.
2. If it can spend money or mutate shared state, add authorization logic before exposing it broadly.
3. Set required secrets with `npx supabase secrets set ...`.
4. Deploy with `npx supabase functions deploy <name> --use-api`.
5. Only use `--no-verify-jwt` when the function is intentionally public or webhook-like and the function code enforces its own trust boundary.

For this repo specifically:

- `generate-katchimera-art` should stay internal/dev-only unless auth or another gate is added.
- `generate-player-avatar` should not remain publicly invokable if selfie-based generation becomes a real feature.

### When wiring onboarding to Supabase in the future

Do not sync the current local onboarding profile directly into a public table and call it done.

Safer path:

1. Introduce a real user identity model first.
2. Decide whether guest usage should use anonymous auth or a separate pre-auth local mode.
3. Create owner-scoped tables keyed to the auth user id.
4. Keep local caching for UX, but treat the database as the source of truth for cross-device state.
5. Move premium entitlements and other shared account state out of local storage.

### When working with Storage

Decide bucket privacy before shipping assets:

- public bucket only if public URL access is truly intended
- private bucket if access should ever depend on auth, entitlement, or ownership

For user-originated files:

- upload originals to a private bucket
- transform or publish derivatives separately if needed
- avoid storing raw personal media in public buckets

## Recommended Cleanup Before Shipping More Supabase Features

These are the most valuable next fixes:

1. Standardize on `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and add an `.env.example`.
2. Lock down `player_avatar_artifacts` and `app_art_settings` with owner-aware policies.
3. Decide whether `/art-lab` and its functions are internal-only.
4. Add auth before making onboarding, avatars, or premium state real user features.
5. Remove or explicitly quarantine the `todos` starter schema.

## Useful Commands

Project and CLI:

```bash
npx supabase --version
npx supabase projects list
npx supabase migration new <name>
```

Functions:

```bash
npx supabase secrets set FAL_KEY=YOUR_FAL_KEY
npx supabase functions deploy generate-katchimera-art --use-api --no-verify-jwt
npx supabase functions deploy generate-player-avatar --use-api --no-verify-jwt
```

Local stack, only when Docker is actually running:

```bash
npx supabase start
npx supabase status
npx supabase db reset
```

## Source Pointers In This Repo

- Onboarding state: `utils/onboarding-state.ts`
- Onboarding screen: `app/onboarding.tsx`
- Tabs gate: `app/(tabs)/_layout.tsx`
- Supabase client: `utils/supabase.ts`
- Avatar client helpers: `utils/avatar-art.ts`
- Art lab route: `app/art-lab.tsx`
- Katchimera function: `supabase/functions/generate-katchimera-art/index.ts`
- Avatar function: `supabase/functions/generate-player-avatar/index.ts`
- Supabase config: `supabase/config.toml`
- Migrations: `supabase/migrations/*`

## External References

These are the Supabase docs that match the patterns used here:

- Expo React Native quickstart
- Storage access control
- Securing Edge Functions
- Edge Function deployment
- Row Level Security

When in doubt, verify against the latest Supabase docs before making schema or auth changes. Supabase moves quickly enough that memory is not a safe source of truth.

# Katchimera Art Pipeline

## Current Setup

Implemented:

- Supabase table: `public.generated_katchimeras`
- Supabase public storage bucket: `katchimera-art-dev`
- Edge Function: `generate-katchimera-art`
- Expo dev route: `/art-lab`

## Remaining Step

Set the fal secret on the linked Supabase project:

```bash
npx supabase secrets set FAL_KEY=YOUR_FAL_KEY
```

After that, redeploy the function:

```bash
npx supabase functions deploy generate-katchimera-art --no-verify-jwt --use-api
```

## Dev Flow

1. Open the app.
2. Go to `World`.
3. Tap `Open art lab`.
4. Pick a family / habitat / stage.
5. Tap `Generate art`.
6. Inspect the result and recent history.

## Notes

- This setup stores generated images remotely instead of bundling them into the app.
- That keeps the app bundle smaller and makes iteration much faster.
- Once the visual style is locked, we can optionally bundle a small flagship subset locally.

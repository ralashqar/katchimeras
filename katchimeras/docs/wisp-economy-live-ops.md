# Wisp economy and live-ops runbook

## Source of truth

- `data/wisps/catalog.json` contains the original 50 production Wisps.
- `data/wisps/catalog.planned.json` contains the full 120-Wisp roster; 51 are
  production-ready and 69 remain planned after Grovelight's Mossprout unlock.
- `npm run wisps:catalog:generate` produces the runtime catalog, typed IDs, literal Expo asset registry, and art briefs.
- Planned Wisps must keep `assetRefs: null`. Promote artwork through the Wisp asset pipeline, set the source entry to `ready`, then regenerate.
- `data/economy/fallback.json` is the safe bundled configuration. Remote configuration may change availability and offers, but may only reference ready IDs known to the installed catalog.

## Safety defaults

Every commerce/live-ops flag ships off. Enable in this order:

1. `economySync` after the ledger and snapshot have been verified.
2. `legacyMigration` for a bounded migration window, then turn it off permanently.
3. Enable the reviewed rows in `economy_avatar_catalog`, then enable `wispShop` with Orbit only.
4. `visitorChoice` only after at least six visitor-pool Wisps have ready art.
5. `plus` after sandbox purchase, restore, webhook, expiry, and reconciliation tests pass.
6. `gifting` and `seasonalTrack` in later releases.

Essence is earned only. Never add a cash-to-Essence offer. Random visitor choices are earned from seven newly captured days, have no rerolls or paid tickets, and let the user choose exactly one of three.

## RevenueCat

Configure entitlement `plus`, offering `default`, and products `katchimeras_plus_monthly` / `katchimeras_plus_annual`. The RevenueCat app user ID must be the Supabase `auth.uid()`.

Store targets are £5.99 monthly and £39.99 annual with a seven-day introductory trial where the storefront permits it. The app always renders localized price strings returned by the store, never hard-coded currency copy.

Client environment:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

The client temporarily accepts the legacy names without `_API_`, but new environments should use the names above.

Edge Function secrets:

- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTHORIZATION`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`
- standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

Point the RevenueCat webhook at `revenuecat-webhook` and configure its authorization header. If a signing secret is configured for the provider, the function also verifies the timestamped HMAC header. Claimed Plus collectibles are permanent grants; subscription expiry only disables ongoing Plus utilities and future claims.

RevenueCat requires a native development or store build. Supabase alone cannot validate App Store subscriptions: Supabase owns the economy ledger and grants, while RevenueCat owns store receipts and entitlement status. After adding or changing the native purchases package, create a new EAS development build before testing with Metro.

## Development subscription simulator

Development builds expose **Dev → Subscription Simulator**. It implements the same `SubscriptionClient` contract as RevenueCat and exercises the real Plus paywall and economy context without store products, credentials, receipts, webhooks, or native purchase calls.

The lab can simulate trial, monthly and annual activation, renewal, cancellation with retained access, expiry, refund, restore, monthly Wisp claim state, and one-shot configure/package/purchase/restore failures. The paywall shows a yellow **LOCAL SUBSCRIPTION SIMULATION · NO CHARGE** banner while it is active.

The simulator is persisted only for development convenience and is hard-gated by `__DEV__`. Production always resolves the shared subscription API to RevenueCat. The simulator works through Metro without a new native build as long as the real RevenueCat adapter is not being tested.

## Data boundaries

The server receives only event type, local date, occurrence time, client event ID, and a stable source hash. It must never receive photo content, journal text, place names, or coordinates for economy credit. Client roles can read their own grants, ledger, claims, and subscription state but cannot insert or update them directly. Mutations go through authenticated functions; webhook/reconciliation writes use the service role only inside Edge Functions.

## Pilot families

- Mossprout: Sprout, Fern, Bloom, Grovelight, Dewdrop; Moss body, Moss Sprout hat, Watering Can.
- Baristabbit: Steam, Crumb, Feast, Crema, Bubble; Barista body, Barista Beret, Cozy Mug.
- Pagelet: Page, Shelf, Chronicle, Inkling, Quill; Storybook Ink body, Graduation Cap, Tiny Storybook.

Pilot constellations intentionally show their five planned identities as placeholders so progression can be reviewed before art promotion. Shop, visitor, or Plus campaigns must not be enabled until every referenced Wisp has ready art and appears in the generated asset registry.

## Current V1 economy values

- Ordinary daily Essence cap: 20. Discovery, seven-hatch, and subscription grants are exempt.
- Wisp prices: common 300, rare 500, epic 800, legendary 1,200.
- Egg prices: body 150/300/500/900; face 60/120/240/450; hats and held items 80/160/320/600.
- Free history insights: latest 14 calendar days. Plus: full local history.
- Free rotating shop: 3 offers. Plus: 6 offers. Selection is stable for user + server date.
- Featured Wisps never imply permanent ownership. Premium Egg pieces are rentals; Essence purchases and monthly Wisp claims are permanent.

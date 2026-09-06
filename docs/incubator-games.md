# Add a game or split one into a separate repository

## Another game in this workspace

1. Create `apps/<game-id>` with its own `package.json`, Expo config, router entrypoints, TypeScript config, `eas.json` and `incubator.json`. Root `apps/*` discovers it automatically. Keep one root lockfile.
2. Choose a unique app name, URI scheme, iOS/Android identifiers, EAS project, storage/database names and backend deployment. Do not inherit Katchimeras production identifiers or saves.
3. Add only needed `@incubator/*` dependencies at exact versions. Use `packages/*/package.json` for required Expo/React peers. The initial compatibility baseline is Expo 54, React 19.1 and React Native 0.81.5.
4. Create module-level bindings for the selected factories. Supply game routes, graph capabilities/effects, data repositories, fonts, source catalogs and layout values. See Katchimeras's `features/content-flow`, `features/navigation`, `constants/game-ui.ts` and `components/katchadeck/home/today-exploration-background.tsx` for real bindings.
5. Keep authored dialogue, quests, economy, unlock rules, screens, save migrations and content IDs in the new app. Never import `apps/katchimeras` from the new game or a shared package.
6. Add selected art packs and static imports. A cinematic-only app can use `@incubator/environments/cinematic`, its own stage catalog and `@incubator/art-world` backgrounds without mounting a hex world.
7. Give authoring commands an explicit `INCUBATOR_GAME_ROOT`. Map the new game's `assets` and `design` roots in `incubator.json`. Existing wrappers show how to resolve installed shared tooling without hardcoded repository-relative paths.
8. Add per-app typecheck and build jobs. Run `npm ci` at the root and Expo/EAS from the selected app directory. Keep TypeScript registry augmentation scoped to one app compilation. Update asset-audit/archive policy for the new app before shipping it.

The current preview workflow intentionally builds Katchimeras only. Its identity and asset policy are game-owned; adding another app does not silently add it to production builds.

## Standalone repository

Use published private-registry versions or the release tarballs described in [releases](incubator-releases.md). Copy the selected game's app/content/configuration into its own repo and install its chosen packages. Shared package implementations and art can then update by version without copying source changes between games.

The exported runtime packages do not require the incubator checkout. The authoring tools require the content profile and recipe inputs the game chooses to use. If retaining the current logical art tree, preserve its relative asset paths; if changing it, update that game's manifests and profile. Selected art packs provide files, while the game supplies the catalog mapping those files to gameplay concepts.

For Deno functions, install/vendor the selected `art-service` release into the function build context and import its exported handler source. Keep each function's Deno configuration and backend secrets in that game. In this monorepo the Katchimeras entrypoints import the shared source directly; deploying them is separate from the native app build.

Run the app's own tests and Metro export against its installed release versions. `npm run verify:consumer` is the repository's small independent-consumer proof, not a substitute for testing a complete new app on a device.

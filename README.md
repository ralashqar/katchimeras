# Game incubator

Katchimeras is the only shipping game. Its Expo app, rules, authored stories, progression, save data adapters, routes and backend configuration live in [`apps/katchimeras`](apps/katchimeras). Reusable runtime code, native integrations and authoring tools are separate npm packages. Games select the art packs they use.

[Egg Snap](apps/egg-snap/README.md) is an independent first playable: puzzle duels, a seven-level campaign, region discovery and cosmetic rewards. Start it with `npm run start:egg-snap`; validate it with `npm run check:egg-snap`. It shares the incubator art and runtime packages and owns its saves and app identity.

```text
apps/katchimeras/       Game composition, content, routes, saves and deployment
apps/egg-snap/          Egg puzzle duels, campaigns, discovery and cosmetic saves
packages/              Shared story, presentation, environments, avatar, UI,
                       merge helpers, native integrations and art service
tooling/art-pipeline/   Shared generation, processing, validation and promotion
tooling/world-editor/   Shared editor implementation; game owns its data/backups
art/assets/            Optional versioned art packs
art-source/katchimeras/ Source art, generation records, review sheets and references
tests/packages/        Shared contracts and cross-game isolation tests
```

Use Node **22.14.0**, Python **3.12** and Pillow **10.3.0**, matching GitHub Actions. Install JavaScript dependencies once, at the repository root:

```sh
npm ci
npm start
npm run verify:workspace
npm run verify:story-flows --workspace=katchimeras
npm run world:editor --workspace=katchimeras
```

`npm run test:game` runs the complete existing game suite. `npm run check` retains the game's broader checks and does not suppress its existing failures; see [verification](docs/incubator-verification.md).

For an iOS preview, dispatch **iOS Preview Build** in GitHub Actions. The workflow installs from the root lockfile, then runs Expo/EAS from `apps/katchimeras`. EAS project, bundle identifiers, extension names and save keys are unchanged. Local equivalents:

```sh
npm run build:ios:preview:check --workspace=katchimeras
npm run assets:audit:write --workspace=katchimeras
npm run build:archive:check --workspace=katchimeras
npm run build:ios:preview
```

See [architecture and migration](docs/incubator-architecture.md), [adding or splitting a game](docs/incubator-games.md) and [package releases](docs/incubator-releases.md). No registry publication or backend deployment is required for local workspace development.

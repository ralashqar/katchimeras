# Refactor verification

Baseline: `0030fc0d29f681bdec8b2684e4dbf8a3231ccc97`. The original app source was extracted from that commit into a separate temporary directory and tested against the same dependencies and art as the refactored app.

| Check | Result |
| --- | --- |
| Shared imports, exports, dependency declarations and cycles | Pass, 16 code/tool packages |
| App and shared TypeScript compilation | Pass |
| Shared React/TypeScript lint | Pass |
| Shared runtime, authoring and server-handler tests | 10/10 pass |
| Independent npm tarball consumer | Pass; separate temporary directory, no game source |
| Existing story-flow gate | 248/248 pass |
| Full existing game suite | 1,331 pass, 45 fail, 4 skipped; identical failure names to baseline |
| iOS and Android Metro/Hermes exports | Pass |
| Runtime asset audit | 2,647 required assets; 176.1 MiB; 900.9 MiB excluded |
| EAS working-tree archive | Pass; 178.4 MiB compressed; all required assets and 40 native/extension files verified |
| Native iOS autolinking | All six moved Expo modules detected |
| Existing preview avatar preflight | Catalog and 522 runtime assets pass |
| Existing hex art pipeline check | Pass |
| Cinematic progression size check | Same baseline failure: expects 2048px, existing stage-0 art is 1536px |
| Clean root dependency install | `npm ci` passes |
| Art relocation integrity | 5,166 original files present; unchanged apart from checkout text line endings |
| Shared world editor | Validation passes with one existing warning; page and shared asset endpoint return HTTP 200 |
| Release packing | All 16 runtime/tool/native packages pack successfully |

The complete failure-name comparison is recorded in [incubator-test-baseline.json](incubator-test-baseline.json). No existing failing test was disabled or added to an allowlist. The `check` command still reports the existing failures, including companion-content/source assertions. Structural tests now follow extracted implementations through the selected game's content profile; native rendering tests propagate their mocks into shared packages and continue testing real React component behavior.

The GitHub preview workflow uses the root lockfile and the new app working directory. It additionally verifies shared packages before the existing preview, story, asset-audit and archive checks. The new workspace workflow checks pull requests without requiring Expo credentials.

A hosted GitHub Actions/EAS native build and a physical-device smoke test have **not** been run for this uncommitted working tree. Successful Metro exports and archive/native-source checks do not establish a successful Xcode build. No package publication or Supabase deployment was performed.

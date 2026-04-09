# iPhone Dev Build Workflow

This project is configured for a Windows-first Expo development build workflow using `eas-cli`, `expo-dev-client`, and a physical iPhone.

## What is already configured

- `expo-dev-client` is installed
- `eas-cli` is installed in the repo
- `eas.json` includes a `development` profile for iPhone dev builds
- `app.json` has a stable first-pass iOS bundle identifier
- package scripts are available for common EAS and Metro commands

## Repo commands

- Log in to Expo:
  - `npm run eas:login`
- Start Metro for the installed dev client:
  - `npm run start:dev-client`
- Create an iPhone development build:
  - `npm run build:ios:dev`
- Retry a clean iPhone development build:
  - `npm run build:ios:dev:clear`
- List recent EAS builds:
  - `npm run eas:builds`

## One-time setup on Windows

1. Create or log in to your Expo account.
2. Make sure your Apple Developer account is active.
3. Run `npm run eas:login`.
4. Run `npx eas build:configure` if Expo asks to link or initialize the remote project.
5. Start the first build with `npm run build:ios:dev`.

## What happens during the first iPhone build

Expo will guide you through:

- linking the app to an Expo project
- authenticating with Apple
- registering your physical iPhone
- creating or reusing signing credentials
- generating the provisioning profile

Use Expo-managed credentials unless you have a strong reason not to.

## Installing the build on your iPhone

1. Wait for the EAS build to finish.
2. Open the build page from the terminal output or from the Expo dashboard.
3. Open the install link on your iPhone.
4. Install the development build.
5. Launch it once so the dev client is ready to connect to Metro.

## Daily iteration loop

1. Run `npm run start:dev-client` on Windows.
2. Open the installed dev build on the iPhone.
3. Connect the dev build to the Metro server by scanning the QR code or selecting the local server.
4. Edit code in VS Code.
5. Use Codex in the same repo as normal.
6. Save and rely on Fast Refresh for most JavaScript and UI changes.
7. Re-test immediately on the device.

## When a rebuild is required

You do not need a new iPhone build for normal JS, styling, routing, or Supabase changes.

You do need a new build when:

- adding or removing native libraries
- changing iOS permissions or config plugins
- changing the bundle identifier
- adding native health integrations such as HealthKit
- changing any native capability that affects the signed app

## KatchaDeck-specific guidance

Use Expo Go only for very early foreground-only experiments.

Use the iPhone development build for:

- onboarding flows
- permission priming
- deck reveal and daily summary flows
- realistic location testing
- later health and background capability work

## Current defaults

- iOS bundle identifier: `com.daruk.katchimeras`
- Android package: `com.daruk.katchimeras`

If you want a different production identifier later, change it before distributing publicly. Changing it later will create a new signed app identity.

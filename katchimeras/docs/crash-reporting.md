# Native crash reporting

Katchimeras uses `@sentry/react-native` for native iOS/Android crashes and JavaScript errors. The SDK is disabled when `EXPO_PUBLIC_SENTRY_DSN` is absent.

## One-time Sentry setup

1. Create a React Native project in Sentry.
2. Add these values to the `development`, `preview`, and `production` EAS environments:
   - `EXPO_PUBLIC_SENTRY_DSN`: the project DSN, plain-text visibility.
   - `SENTRY_ORG`: the Sentry organization slug, plain-text visibility.
   - `SENTRY_PROJECT`: the Sentry project slug, plain-text visibility.
   - `SENTRY_AUTH_TOKEN`: an organization token scoped to release creation and source-map upload, sensitive visibility.
3. Create a new development/preview native build. Adding Sentry changes the native binary and cannot be delivered to an older binary only through EAS Update.
4. In Developer tools, press **Test native crash reporting**, reopen the app, and verify that the native stack is symbolicated.

EAS Build uploads native symbols through the Sentry config plugin. The repository's `update:*` scripts upload the generated EAS Update source maps after publishing.

## Merge FTUE diagnostics

Merge FTUE reports only operational identifiers: focus-session ID, mount ordinal, FTUE step, coordinator phase, board revision, command ID, operation ID, and interaction-gate acknowledgement. Journal content and other personal data are never attached.

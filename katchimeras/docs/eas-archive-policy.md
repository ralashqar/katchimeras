# EAS archive policy

The Git root is one directory above the Expo app. EAS CLI 22.4.0 copies that
repository root and reads `.easignore` there, even when invoked from the app.
Do not move the upload policy into the nested `katchimeras` directory.

From the Expo app directory:

```sh
npm run assets:audit:write
npm run build:archive:check
```

The audit exports both native platforms, retains native configuration/widget
assets and duplicate asset aliases, and updates root-relative exclusions.
Source masters, obsolete art and experiments remain available locally/in Git
but unused assets are omitted from EAS. Required PNGs, fonts and animation
resources remain included; WebP is not a safe blanket file-type filter.

The archive check uses the installed EAS copy implementation, verifies every
required asset survives, rejects known development directories, creates a
compressed tar archive and enforces a 1 GiB budget below EAS's 2 GB limit.
Its temporary copy and archive are removed afterward. It does not submit a
build or touch signing credentials. Preview CI runs both commands before EAS.

See `eas-asset-audit.md` for the current required/excluded totals. To retire
additional legacy runtime art, remove its obsolete code/catalogue references
first, regenerate this audit, and verify native exports before deleting masters.

Verified on 2026-09-06: 178.4 MiB compressed, 4,179 archived files and 2,647
required assets retained. The refreshed asset exclusions remove 900.9 MiB of
unused assets in addition to source design folders. Both iOS and Android Expo
exports completed successfully. CI measures each new archive independently.

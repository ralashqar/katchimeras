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

The archive check uses the installed EAS Git client (shallow clone followed by
filtered working-tree copy), verifies every
required asset survives, verifies all tracked local module and target files
byte-for-byte, rejects known development/generated app directories, creates a
compressed tar archive and enforces a 1 GiB budget below EAS's 2 GB limit.
Its temporary copy and archive are removed afterward. It does not submit a
build or touch signing credentials. Preview CI runs both commands before EAS.

See `eas-asset-audit.md` for the current required/excluded totals. To retire
additional legacy runtime art, remove its obsolete code/catalogue references
first, regenerate this audit, and verify native exports before deleting masters.

The root policy must contain `.git` without a trailing slash. EAS's Git client
checks `ignore.ignores('.git')` explicitly before deleting its cloned database.
`.git/` does not match that literal check: source-art blobs remain in the Git
object packs even though their working files were correctly excluded.

The original 178.4 MiB measurement checked only the filtered working files and
missed this extra database. The strengthened check rejects that rule error
before cloning and verifies the resulting clone has no `.git` at all.
The refreshed asset exclusions remove 900.9 MiB of unused assets in addition
to source design folders. Both iOS and Android Expo exports pass, and CI now
measures the Git-backed archive rather than a file-copy approximation.

The generated native project exclusions must be anchored to `/katchimeras/ios/`
and `/katchimeras/android/`. An unanchored `ios/` rule also strips the local
modules' podspecs and Swift sources, causing `pod install` to fail. Those sources
are not represented in Metro's asset map, so the archive check separately
enumerates tracked files under `modules/` and `targets/`, checks the ignore policy
before cloning, and verifies their contents in the staged archive.

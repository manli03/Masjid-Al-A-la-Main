# Android APK updates

The app reads Android Studio build metadata from
`https://oc-manli.duckdns.org/masjidala/output-metadata.json`, then downloads the matching
APK from the latest stable public GitHub Release in `manli03/Masjid-Al-A-la-Main`.
The APK checksum comes from GitHub's release asset digest, not the metadata server.
The repository and metadata URL are configured in `android/app/src/main/res/values/updater.xml`;
the native URL allowlist must also be updated when changing the metadata host/path.
No GitHub token belongs in the application.

## Publishing a release

1. Increase `versionCode` in `android/app/build.gradle` for every release, and set the
   intended `versionName`. Android's values are authoritative, not `package.json`.
2. Build a signed **universal APK** in Android Studio using the **existing release key**.
   Keep this key backed up securely. Debug builds cannot install release-key updates.
   Before building, run `npm run build` and `npx cap copy android` to include the
   latest web application in the native package.
3. Create a draft GitHub Release and upload the signed `app-release.apk`.
   Keep the APK filename exactly equal to `elements[0].outputFile` in its generated
   `output-metadata.json` (normally in `android/app/release/`). Do not hand-edit the
   generated metadata or upload an AAB/split APKs. New releases do not need metadata
   uploaded to GitHub.
4. Add user-facing release notes. Ensure GitHub's APK asset has a `sha256:…` digest
   through the release assets API. Missing digests cause the updater to fail closed.
5. Publish the complete release as the latest stable release (not a prerelease).
   Then upload the matching build's `output-metadata.json` to the server URL above.
   Publish the server file atomically (upload under a temporary name, then rename)
   and serve it with `Content-Type: application/json` and `Cache-Control: no-store`.
   This order ensures metadata only announces an APK that is already available.
   Do not replace APKs on a published release; publish a higher version instead.
6. Your existing public APK link can redirect to
   `https://github.com/manli03/Masjid-Al-A-la-Main/releases/latest/download/app-release.apk`.
   This supports the old browser updater and new installations. The new updater uses
   GitHub's release API, then immutable, version-specific download URLs.

Existing app installations need one update using the old flow to get this updater.
Keep hosting the legacy `update.json` with a changed `lastPreviousUpdate` value for
that migration; the old updater still needs it. The new updater ignores that date.

Version 1.3.0 still reads metadata from the latest GitHub Release. If the transition
release has no GitHub metadata, 1.3.0 users must manually install the new build from
the existing APK link. Alternatively, include matching metadata on GitHub for that
one transition release, then stop uploading it for subsequent releases. Leaving the
old metadata attached to an older release does not help: 1.3.0 checks only the latest
release. Metadata is public build information, not a credential. APK authenticity is
enforced by checksum and signing-certificate checks.

## Behavior and security

- Automatic checks happen after startup and when returning to the app, with a
  six-hour successful-check interval and a 15-minute retry delay after errors.
- Automatic download prompts appear at most once per device-local calendar day.
  Download consent includes automatically opening Android's installer after verification.
  Cancelled installation is retried automatically at most once per day; manual checks
  and the progress panel's Install button bypass this delay.
- Downloads only start after consent. Android DownloadManager maintains downloads
  while the app is closed; saved download IDs restore status on reopening. No
  installation screen is opened while the app is in the background.
- A global in-app panel displays percentage, transferred MB, paused/verification status,
  installation handoff, and failure details on every screen. It can be minimized.
  DownloadManager also displays download notifications. Completed downloads are verified
  when the app next checks, then the system installer opens automatically in the foreground.
  Invalid downloads display an error immediately, even if today's download reminder was shown.
- APK size, SHA-256, package ID, Android compatibility, version code/name, and current
  signing certificate are checked before installation. The checksum is checked again
  immediately before handing the file to Android's installer. Certificate rotation
  is intentionally rejected and needs a separate migration plan.
- The updater's metadata HTTP client explicitly restores TLS chain and DNS checks,
  because this project includes `ssl-skip`, which alters global HTTPS defaults.
- Android may require “Allow from this source” permission. The app explains this
  only after the user chooses Install, and continues when returning from Settings.
  Android always controls the final installation confirmation. Cancelling keeps
  the APK ready for later. Successful updates and retries clean up obsolete downloads.
- Server/GitHub outages and rate limits do not block app startup. GitHub's public API
  has shared unauthenticated limits; a caching proxy for release metadata can be added
  if usage grows. APK traffic goes directly to GitHub.
- The APK is stored under an app-specific directory and shared through a dedicated,
  non-exported FileProvider restricted to the updates directory. No broad storage
  permission is needed.

## Device acceptance checks before distribution

Use two signed builds with the same key and increasing version codes. Verify:

- Declining download; once-daily reminder; manual check bypass; no update available.
- Progress, airplane-mode pause/recovery, insufficient storage, closing/reopening.
- Complete download while backgrounded; verify and open installer upon foregrounding.
- Cancelling the Android installer; returning later; using the manual Install button.
- Granting/denying install-source permission and returning from Android Settings.
- Corrupt APK, wrong signing key/package/version, missing digest/metadata, prerelease.
- Upgrade preserves login/settings, removes the pending update, and prayer alarms
  and azan notifications continue working after replacement and device restart.

Do not simulate a new update by editing only `output-metadata.json`. Build a second
signed APK with a higher native `versionCode` and upload its generated metadata with it.
An APK/metadata version mismatch must fail verification and must never be installed.

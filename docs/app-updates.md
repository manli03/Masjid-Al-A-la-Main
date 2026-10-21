# Android APK updates

The app checks the latest stable public GitHub Release in `manli03/Masjid-Al-A-la-Main`.
Change `android/app/src/main/res/values/updater.xml` to use another public repository.
No GitHub token belongs in the application.

## Publishing a release

1. Increase `versionCode` in `android/app/build.gradle` for every release, and set the
   intended `versionName`. Android's values are authoritative, not `package.json`.
2. Build a signed **universal APK** in Android Studio using the **existing release key**.
   Keep this key backed up securely. Debug builds cannot install release-key updates.
   Before building, run `npm run build` and `npx cap copy android` to include the
   latest web application in the native package.
3. Create a draft GitHub Release. Upload BOTH files from the same Android Studio build:
   `app-release.apk` and `output-metadata.json` (normally in `android/app/release/`).
   Keep the APK filename exactly equal to `elements[0].outputFile` in the metadata.
   Do not hand-edit the generated metadata or upload an AAB/split APKs.
4. Add user-facing release notes. Ensure GitHub's APK asset has a `sha256:…` digest
   through the release assets API. Missing digests cause the updater to fail closed.
5. Publish the complete release as the latest stable release (not a prerelease).
   Do not replace assets on a published release; publish a higher version instead.
6. Your existing public APK link can redirect to
   `https://github.com/manli03/Masjid-Al-A-la-Main/releases/latest/download/app-release.apk`.
   This supports the old browser updater and new installations. The new updater uses
   GitHub's release API, then immutable, version-specific download URLs.

Existing app installations need one update using the old flow to get this updater.
Keep hosting the legacy `update.json` with a changed `lastPreviousUpdate` value for
that migration; the old updater still needs it. The new updater ignores that date.

## Behavior and security

- Automatic checks happen after startup and when returning to the app, with a
  six-hour successful-check interval and a 15-minute retry delay after errors.
- Automatic prompts appear at most once per device-local calendar day. Download
  completion gets its own first installation prompt, even on the same day. Choosing
  Later suppresses further automatic prompts that day. Manual Settings checks bypass
  the reminder and check intervals.
- Downloads only start after consent. Android DownloadManager maintains downloads
  while the app is closed; saved download IDs restore status on reopening. No
  installation screen is opened while the app is in the background.
- DownloadManager displays download notifications; Settings displays progress and
  ready/failed status. Completed downloads are verified when the app next checks.
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
- Complete download while backgrounded; first install prompt upon foregrounding.
- Declining installation; returning later; cancelling the Android installer.
- Granting/denying install-source permission and returning from Android Settings.
- Corrupt APK, wrong signing key/package/version, missing digest/metadata, prerelease.
- Upgrade preserves login/settings, removes the pending update, and prayer alarms
  and azan notifications continue working after replacement and device restart.

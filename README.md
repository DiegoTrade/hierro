# Hierro

A personal gym logbook for Diego. English exercise names with Spanish labels, kilograms, offline logging, and a four-day strength programme with an optional Engine day.

Built with plain HTML, CSS and JavaScript. No package installation, build step, account or server database is required.

Live app: [diegotrade.github.io/hierro](https://diegotrade.github.io/hierro/).

## Programme provenance

This version reconstructs the programme from the supplied brief. The referenced `hierro-reference.html` was not supplied, so this is **not a verified port of its complete exercise catalogue or original code**. Review the reconstructed exercise order, volume, supersets and estimated duration before treating them as an exact reproduction. Session history preserves the prescription used at the time.

The five-week block contains four building weeks and a deload. Load suggestions are editable references, not automatic changes to the weights actually recorded. Week changes do not certify a load increase.

## Run locally

From this directory:

```sh
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Use HTTP on localhost or HTTPS when deployed; opening `index.html` directly does not provide a functioning service worker.

There are no runtime dependencies on external CDNs. Fonts, icons and programme data are local. Form-video searches open YouTube and require an internet connection.

## Publish on GitHub Pages

1. Create a repository named `hierro` and put the contents of this directory at its root.
2. Commit and push the files to the repository's default branch.
3. In the repository, open **Settings → Pages**. Select **Deploy from a branch**, the default branch, and **/(root)**; save.
4. Wait for GitHub Pages to finish deployment, then open `https://YOUR-USERNAME.github.io/hierro/`.

The app uses relative paths, so it works at the `/hierro/` project path. The included `.nojekyll` keeps the site as plain static files. Do not move it to a new origin without first exporting its data.

On iPhone, open the published HTTPS address in Safari, then choose **Share → Add to Home Screen**. Launch the installed app once online and allow the initial shell to finish caching before relying on offline use.

## Data and backups

Training records live in this browser or installed app's `localStorage` under `hierro-strength-v1`. There is no cloud account or automatic cross-device synchronization. Browser storage can be cleared or evicted; keeping the app installed is not a replacement for an external backup.

Use **Settings → Export JSON** regularly and keep the file outside the browser. CSV exports are for analysing sets and cannot restore the app. A JSON restore replaces current data after validation and confirmation; export the current log first if you want to keep it.

Use the same installed app consistently. Export before changing phone, browser, deployment address or installation. The app's **Last export** date records the export action; it cannot verify that the file was kept.

## Offline use and releases

`sw.js` stages the complete shell in a release-specific cache. Once controlled by the service worker, navigation uses that cached release so an update cannot mix new HTML with old workout code. An update waits until the app offers it and the user chooses to apply it. The service worker does not force a reload during a workout.

For each release:

1. Increase `VERSION` in `sw.js` and the displayed app version together.
2. Add any new required local assets to `SHELL` in `sw.js`.
3. Deploy every file in the release together.
4. Verify the first online load, a waiting update, and an offline relaunch at the final project URL.

Only cache names belonging to this Hierro deployment are removed. User training data is independent of the service-worker cache. Clearing all site data still removes the training data as well.

The timer saves its deadline and recovers the correct remaining/elapsed state after reload or phone lock. A sound at the exact moment of expiry while iOS is suspended is not guaranteed. Sound, vibration where supported, and screen awake are optional enhancements.

## Source layout

| File | Purpose |
|---|---|
| `index.html` | Accessible app shell, installation metadata and entry point |
| `styles.css` | Phone layout, typography, themes and safe areas |
| `app.js` | Screens, input, workout flow and device capabilities |
| `data.js` | Exercise catalogue and programme definitions |
| `engine.js` | Loading, progression, deload and summary calculations |
| `storage.js` | Versioned persistence, export and restore |
| `sw.js` | Complete-release offline caching and update lifecycle |
| `manifest.webmanifest` | Standalone installation metadata |
| `assets/` | Local fonts, licences and app icons |

## Before release

- Log and finish a workout at 390 px and 320 px; check keyboard access and the rest timer.
- Reload during a draft and during rest; verify values and the timer deadline survive.
- After initial caching, relaunch in airplane mode, log work, finish and reload.
- Export JSON, clear test data and restore; compare sets, cardio, notes, settings and the draft.
- Verify invalid restores leave existing data unchanged and failed saves remain visible.
- Check progression after full-range sets, partial sessions, swaps and a deload.
- Verify assets, installation and offline fallback under the actual `/hierro/` URL.
- Apply an update after saving a draft and confirm that the draft survives.

## Verification

Run the included 27 domain, integration and persistence checks with Node.js 20 or newer:

```sh
npm test
```

No dependency installation is needed. The tests cover complete/partial progression, assistance direction, deloads, equipment identity, swapped-set totals, supersets, historical comparisons, backup validation, damaged data, quota failure and JSON/CSV round trips.

Browser verification for version 1.0.0 completed a 13-set Lower A session with cardio and notes, checked rest extension and reload recovery, rejected invalid inputs, confirmed a 42.5 kg suggestion after 40 kg for 3 × 10, restored an exported notebook after replacing it with an empty one, and rejected a newer unsupported backup. The app also reloaded and saved a new set with the local HTTP server stopped, using only the cached shell. Light and dark themes and narrow responsive layouts were inspected. Physical iPhone keyboard, sound and wake-lock behaviour should still be checked on the intended device.

## Assets and font licences

The original code-native H/barbell icon is supplied as `assets/icon.svg` with 192 px, 512 px, maskable 512 px and Apple 180 px PNG exports. The monogram stays inside the maskable safe zone.

Barlow Regular 400, Barlow Semibold 600 and Barlow Condensed Medium 500, Semibold 600 and Bold 700 are self-hosted Latin WOFF2 files from Google Fonts. Barlow is by Jeremy Tribby and distributed under the SIL Open Font License 1.1. The full licences are in `assets/LICENSE-Barlow.txt` and `assets/LICENSE-BarlowCondensed.txt`.

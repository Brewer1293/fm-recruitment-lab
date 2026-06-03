# FM Recruitment Lab

Static browser-side FM24 recruitment app for scoring large Football Manager HTML exports against the selected tactic roles.

Live app: `https://home.brewerlabs.uk/fm-recruitment/`

## What It Does

- Imports Football Manager player search HTML exports directly in the browser.
- Supports very large all-player exports.
- Scores players against balanced FM24 role profiles.
- Separates pure role fit from signing/value logic.
- Loads a default player database from Cloudflare R2 when available.
- Loads player faces, club logos and nation logos from the `assets.brewerlabs.uk` asset bucket.
- Provides FM-style player profiles, STAG stat baselines, comparison tools, import validation and export options.

## Privacy Model

Manual FM HTML uploads are parsed in browser memory. They are not posted to an app server.

The default database and graphic assets are downloaded from Cloudflare R2/CDN. Use **Clear local data** in the app to discard the current in-memory player pool. Use **Clear cached default** on the Import screen if the browser should redownload the default database next time.

## Run Locally

From the repository root:

```bash
npm --prefix fm-recruitment install
npm --prefix fm-recruitment run dev -- --hostname 127.0.0.1 --port 4175
```

Open `http://127.0.0.1:4175/`.

## Production Build

Standalone FM app build:

```bash
NEXT_PUBLIC_BASE_PATH=/fm-recruitment npm --prefix fm-recruitment run build
```

Full site build from the repository root:

```bash
npm run build
```

The full build exports the FM app and copies it into the root site at `public/fm-recruitment`, then builds the Vite project into `dist`.

## Football Manager Export Workflow

1. In FM24, open player search or the relevant player list.
2. Add the useful columns: name, age, DOB, UID, club, nation, position, preferred foot, left foot, right foot, height, transfer value, wage, minutes, average rating, attributes and relevant per-90 stats.
3. Export the view as a web page / HTML file.
4. Open FM Recruitment Lab and upload the HTML file on the Import screen.
5. Check Settings for the validation report if columns are missing.
6. Use Tactic, Rankings, Compare and player profiles to scout.

## Default Database

The app can load a saved default dataset from:

```text
https://assets.brewerlabs.uk/datasets
```

The browser checks `default-metadata.json`, downloads the referenced compressed dataset, decompresses it locally and caches it in IndexedDB. **Refresh database** forces a new download when the R2 dataset has changed.

## Graphic Assets

Graphic assets are resolved from:

```text
https://assets.brewerlabs.uk
```

Current examples:

- Faces: `/faces/faces/face_<playerUID>.png`
- Club/nation logos: resolved through the generated UID/path maps in `src/lib/generated/`

Asset resolution lives in `src/lib/assetResolver.ts`.

## Scoring Model

Role configuration lives in `src/lib/roleConfig.ts`. Scoring logic lives in `src/lib/scoring.ts`.

The current balanced model separates:

- **Role Score** - pure football role suitability.
- **Recruitment Score** - signing/value score using Role Score plus market value, wage and age/development.
- **Confidence Score** - recommendation reliability from minutes, missing data, hidden/profile data and position certainty.

Role Score uses:

- Attribute Score: 70%
- Position/Foot Score: 15%
- Hidden/Profile Score: 10%
- Adjusted Performance Stats Score: 5%

Recruitment Score uses:

- Role Score: 70%
- Market Value Score: 15%
- Wage Efficiency Score: 5%
- Age/Development Score: 10%

Value, wage and age do not directly reduce pure Role Score.

## Stat Shrinkage

Performance stats are sample-size adjusted:

```text
adjustedStatsScore = 50 + ((rawStatsScore - 50) * minutesConfidence)
```

Small samples are pulled back toward 50 so low-minute players do not jump above elite players on per-90 noise.

## Missing Data

- Missing attributes are excluded from the weighted denominator and warned.
- Missing stats are excluded from the stat denominator and warned.
- Missing hidden/profile data is treated neutrally and lowers confidence.
- `Not for Sale` is treated as a club stance, not a zero value.
- Transfer value ranges use the midpoint for display and scoring.

## Main Files

- `src/app/page.tsx` - main app UI and player profile modal.
- `src/app/globals.css` - FM-style theme and layout.
- `src/lib/fmParser.ts` - HTML import, aliases and validation report.
- `src/lib/scoring.ts` - scoring engine.
- `src/lib/roleConfig.ts` - tactic roles, weights, caps and warnings.
- `src/lib/defaultDataset.ts` - default R2 dataset loader/cache.
- `src/lib/assetResolver.ts` - face/logo/nation asset URL resolution.

## Deployment

Deploy through the root repository, not this nested app directly:

```bash
npm run build
git push origin main
```

Cloudflare Pages builds `main` and publishes `dist` to `home.brewerlabs.uk`.

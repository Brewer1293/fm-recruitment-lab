# Miracle One Recruitment Web

Static Next.js web app for FM24 recruitment scoring against the Miracle One
4-2DM-3-1 tactic.

## Privacy model

FM HTML files are parsed and scored in browser memory. Uploaded player data is
not posted to a server and is not stored in localStorage. Reload the page or use
**Clear local data** to discard the current dataset.

## Run locally

```powershell
cd webapp
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```powershell
cd webapp
npm ci
npm run build
```

The static site is exported to `webapp/out`.

## Deploy with Cloudflare Pages

1. Push this repository to GitHub.
2. In Cloudflare Pages, create a project from that GitHub repository.
3. Set the root directory to `webapp`.
4. Set the build command to `npm run build`.
5. Set the output directory to `out`.
6. Add the custom domain `home.brewerlabs.uk`.

The included GitHub Actions workflow can also publish the same static export to
GitHub Pages. For `home.brewerlabs.uk`, Cloudflare Pages is the recommended
target because DNS and TLS can stay in the existing Cloudflare setup.

## Scoring

Role profiles live in `src/lib/roleConfig.ts`. The scoring engine lives in
`src/lib/scoring.ts`. The current score mix is:

- Attributes: 55%
- Performance: 20%
- Hidden/personality: 10%
- Position and footedness: 10%
- Value efficiency: 5%

Missing categories are omitted and the available score weights are
re-normalized. The player modal still displays missing-data warnings.

## FM columns

The normalization aliases live in `src/lib/fmParser.ts`. The importer preserves
every detected source column on `player.raw`, while mapping the fields used by
the scorer. Add aliases there as new FM export variants appear.

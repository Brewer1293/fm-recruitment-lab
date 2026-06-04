# Changelog

This log tracks user-facing changes to FM Recruitment Lab.

Update this file before each live push to the standalone FM app.

## Unreleased

- Added a 7,571-player mobile default database from `MobileList.html` and auto-load it on mobile-like browsers instead of the full saved pool.
- Added separate full/mobile default database caching and refresh controls on Import.
- Added a mobile safe-mode guard that prevents the full default database from auto-loading on mobile-like browsers, avoiding reload loops.
- Highlighted the leading player dot on Data Hub charts and mini plots in red for quicker scanning.
- Added Data Hub role/slot and minimum-minutes controls so analytics can be explored without returning to Tactic.
- Changed Shortlist into a transfer-focused view with value, wage, contract, expiry, playing time and league context columns.
- Added a local interactive Data Hub with FM-style analytics cards, scatter charts, hoverable player dots and metric leaders.
- Added a local Shortlist tab and Scouting star action for collecting broader recruitment targets.
- Moved Import lower in the sidebar, directly above Settings.
- Added league coefficient weighting to performance metrics, STAG score impacts and loaded-dataset STAG baselines.
- Added the R2 bucket CORS config used by the default database and local preview ports.
- Tightened STAG baselines so they are calibrated from top role-fit players, with robust high-percentile handling for volatile percentage metrics.
- Restricted STAG baselines to players whose primary exported position matches the tactic slot, preventing secondary-position hybrids from setting unrelated metric baselines.
- Contained Settings and player-profile STAG tables so wide metric data scrolls inside the table instead of spilling off-screen.
- Made full-back role scoring side-specific for LB/RB slots and reset Scouting sorting to Role Score when changing tactic slots.
- Made Role position only the default Scouting filter and added position-fit score caps so weak conversions cannot rank near the top.
- Made Role position only require the player's primary exported position group and reduced secondary-position BPD fits from natural to competent.
- Made BPD/CB stricter by downgrading centre-back plus central-midfield hybrids from natural CB fit.
- Prioritised left-footed players at LB/LCB and right-footed players at RB/RCB, while keeping inside forwards inverted-foot aware.

## Live History

### 2026-06-03

- `754d1c5` Added a Settings STAG baselines section showing which players set each role/metric benchmark.
- `955f31a` Moved player profile ranking navigation so it no longer overlaps the close button.
- `665b252` Added a Settings theme picker with Classic Orange, Cool Blue and Emerald Green accent themes.
- Split FM Recruitment Lab into its own standalone GitHub repository and Cloudflare Pages deployment path.
- Added player profile ranking navigation with up/down controls and keyboard arrows.
- Improved Scouting filter readability.
- Added apps, goals and assists to Scouting.
- Replaced profile scoring notes with strengths, score breakdown and weaknesses.
- Calibrated STAG tiers from the loaded dataset.
- Added total minutes to the STAG summary.
- Improved tactic screen layout.
- Tightened player profile role selectors and tab layout.
- Made the player profile more responsive and hid visible modal scrollbars.
- Moved validation into Settings.
- Expanded and polished the import screen.
- Upgraded comparison view.
- Improved FM asset logo resolution and removed profile placeholders.
- Added the default R2 player database loader.
- Added app instructions page.
- Added visible app version badge.
- Built the FM-style player profile, FM skin-inspired theme, profile tabs, top information card and asset UID resolution.
- Added FM-aware position dropdown and collapsible filters.

### 2026-06-02

- Added the initial browser-side FM recruitment app.
- Replaced the original scorer with the balanced FM24 role model.
- Fixed large HTML import stack overflow.
- Added role position suitability filtering.
- Skipped masked FM player rows.
- Restored the charcoal/orange profile styling.

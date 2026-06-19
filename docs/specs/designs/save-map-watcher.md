---
abstract: Runtime, automation, tooling, and verification design for the Satisfactory save map watcher.
out_of_scope: Windows service packaging, system tray UI, save-file parsing, third-party API reverse engineering, and multi-directory configuration.
---

# Design: save-map-watcher

## Active Truth Policy
- Keep only currently accepted decisions in this active document.
- Remove superseded decisions instead of keeping deprecation narratives.
- If decision status is unclear, require clarification before finalizing updates.

## Context
- **Purpose:** Provide a local script that watches Satisfactory save files and keeps an interactive map page loaded with the latest save.
- **Scope/Boundaries:** The module owns local save discovery, change monitoring, debounce scheduling, one browser page, file upload automation, command scripts, and local quality checks.
- **Related Requirements:** R-001, R-002, R-003, R-004, R-005, R-006, R-007.

## Constraint Projection
- **Governing Constraints:** R-001 through R-005 define save detection and map submission behavior. R-006 and R-007 define local operation and quality expectations.
- **Detail Commitments:** The project uses Node.js, TypeScript, `pnpm@10.33.0`, Playwright, Biome, Vitest, pre-commit, and commitlint. The map URL is `https://satisfactory-calculator.com/zh/interactive-map`. The default Windows save root is `%LOCALAPPDATA%\FactoryGame\Saved\SaveGames`.
- **Update Rule:** Keep requirement text stable while the high-level user outcomes remain valid. Update this design when runtime dependencies, commands, file layout, selectors, or verification details change.

## Inputs & Outputs
- **Inputs:** `.sav` files under the default Satisfactory Windows save root, including nested account or profile directories.
- **Outputs:** A visible Chromium page containing the Satisfactory Calculator interactive map loaded from the latest selected save.
- **Artifacts:** TypeScript source files, tests, pnpm lockfile, Biome configuration, TypeScript configuration, pre-commit hook configuration, commitlint configuration, and a README.

## Design Approach
- **Approach:** A TypeScript command-line script runs in the foreground. It scans for the latest save at startup, opens one Playwright-controlled Chromium page, uploads the latest save when available, and listens for later save changes.
- **Key Elements:**
  - `src/index.ts` starts the process, validates the save root, performs startup scanning, wires file watching, applies a 2 second debounce, and coordinates uploads.
  - `src/saves.ts` resolves the default save root and recursively finds the most recently modified game `.sav` file, excluding Satisfactory server manager metadata files.
  - `src/debounce.ts` provides a small debounced async task runner for coalescing rapid save events.
  - `src/uploader.ts` owns the Playwright browser/page lifecycle, starts Chromium maximized with the real browser window viewport, reloads the interactive map URL in the same page before each upload, locates the page upload control, submits the selected file through Playwright, waits for the upload panel to disappear, and reuses one page for repeated uploads.
  - `test/saves.test.ts` covers save discovery, metadata exclusion, and default path resolution.
  - `test/uploader.test.ts` covers browser launch and viewport options.
  - `test/debounce.test.ts` covers debounce behavior.
  - `package.json` exposes `dev`, `build`, `start`, `lint`, `fix`, `typecheck`, `test`, `check`, and `hooks:install` scripts.
  - `.pre-commit-config.yaml` defines a `pre-commit` hook that runs `pnpm run check` and a `commit-msg` hook that runs `pnpm exec commitlint --edit`.
- **Interactions:** `index.ts` calls `saves.ts` for path and save selection, then calls `uploader.ts` with a selected save path. Change events trigger a debounce timer; when the timer fires, `index.ts` rescans the save root and uploads the newest `.sav`.

## Runtime Behavior

- Startup fails with a clear error when `%LOCALAPPDATA%` is not set or the default save root does not exist.
- Startup continues watching when the save root exists but no `.sav` files are present.
- Upload failures are printed to the console and do not stop file watching.
- Successful upload logging happens only after the interactive map has moved past the upload panel.
- If the third-party upload control cannot be found, the script reports that the map page structure may have changed.
- The browser remains open until the script exits.
- The script does not close the browser automatically after uploads.

## Tooling

- `pnpm run dev` runs `tsx src/index.ts`.
- `pnpm run build` runs `tsc -p tsconfig.json`.
- `pnpm run start` runs `pnpm run build && node dist/index.js`.
- `pnpm run lint` runs `biome ci .`.
- `pnpm run fix` runs `biome check --write .`.
- `pnpm run typecheck` runs `tsc -p tsconfig.json --noEmit`.
- `pnpm run test` runs `vitest --run`.
- `pnpm run check` runs lint, typecheck, and tests.
- `pnpm run hooks:install` runs `pre-commit install --hook-type pre-commit --hook-type commit-msg`.
- `pnpm exec playwright install chromium` installs the browser dependency required by Playwright.
- Git hook installation requires the `pre-commit` command to be available on `PATH`.

## Validation
- **Checks:** Automated tests cover recursive latest-save selection, ignoring non-save files, ignoring Satisfactory server manager metadata saves, null results when no saves exist, default Windows save-root resolution, browser viewport options, and debounce coalescing. Local quality checks run Biome, TypeScript, and Vitest.
- **Evidence:** `pnpm run check` passes. Manual validation runs `pnpm run dev`, confirms one Chromium page opens on the interactive map, confirms startup upload of the newest save when one exists, and confirms a later `.sav` create or overwrite event reuses the same page after the debounce window.

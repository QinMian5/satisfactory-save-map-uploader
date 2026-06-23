---
abstract: Runtime, desktop packaging, automation, tooling, and verification design for the Satisfactory save map uploader.
out_of_scope: Automatic updates, tray behavior, signing integration, Store submission, save-file parsing, third-party API reverse engineering, and multi-directory configuration.
---

# Design: save-map-uploader

## Active Truth Policy

- Keep only currently accepted decisions in this active document.
- Remove superseded decisions instead of keeping deprecation narratives.
- If decision status is unclear, require clarification before finalizing updates.

## Context

- **Purpose:** Provide a local Electron desktop application that uploads selected Satisfactory save files into an interactive map page.
- **Scope/Boundaries:** The module owns local save discovery, change monitoring, debounce scheduling, one embedded map view, file upload automation, status-window state, command scripts, desktop packaging, and local quality checks.
- **Related Requirements:** R-001, R-002, R-003, R-004, R-005, R-006, R-007, R-008, R-009, R-010, R-011.

## Constraint Projection

- **Governing Constraints:** R-001 through R-005 define save detection and map submission behavior. R-006 and R-007 define local operation and quality expectations. R-008 defines desktop packaging expectations. R-009 defines release-readiness validation expectations. R-010 defines third-party upload disclosure and revocation expectations. R-011 defines interface language and map-locale expectations.
- **Detail Commitments:** The project uses Electron, Electron Forge, Electron Forge Vite Plugin, React, Tailwind CSS, shadcn-style component primitives, TypeScript, `pnpm@10.33.0`, Biome, Vitest, pre-commit, and commitlint. Supported application languages are registered centrally as `en` and `zh-CN`; their map URLs are `https://satisfactory-calculator.com/en/interactive-map` and `https://satisfactory-calculator.com/zh/interactive-map`. The default Windows save root is `%LOCALAPPDATA%\FactoryGame\Saved\SaveGames`.
- **Update Rule:** Keep requirement text stable while the high-level user outcomes remain valid. Update this design when runtime dependencies, commands, file layout, selectors, packaging, or verification details change.

## Inputs & Outputs

- **Inputs:** `.sav` files under the default Satisfactory Windows save root, including nested account or profile directories.
- **Outputs:** A local status window with a reusable embedded Electron map view containing the Satisfactory Calculator interactive map loaded from the latest selected save, an unpacked Windows app package, a guided Windows installer artifact, a portable zip artifact, and a Store-oriented AppX/MSIX-family package artifact.
- **Artifacts:** TypeScript source files, React renderer files, Tailwind stylesheet entry, tests, pnpm lockfile, Electron Forge configuration, Vite configuration, Biome configuration, TypeScript configuration, pre-commit hook configuration, commitlint configuration, GitHub Actions workflows, documentation, and MIT license text.

## Design Approach

- **Approach:** An Electron application starts a local status window, loads local consent preferences, opens the embedded map only after the current third-party upload disclosure has been accepted, and starts save watching only after the user requests monitoring in the current session. Business services are separated from Electron window lifecycle and renderer presentation.
- **Key Elements:**
  - `src/main/app.ts` wires Electron lifecycle, single-instance lock, status window, embedded map view, state, IPC handlers, and service cleanup.
  - `src/main/lifecycle.ts` contains pure startup, smoke-mode, lock, and second-instance focus decisions.
  - `src/main/runtime-controller.ts` coordinates preferences, revocation marker persistence, in-memory upload consent, lazy watcher/uploader creation, start/stop persistence, manual upload/open-map commands, and revocation cleanup.
  - `src/main/preload.ts` exposes a minimal `window.satisfactoryApp` API through `contextBridge`.
  - `src/main/preload-api.ts` constructs the preload API without exposing raw Electron IPC objects.
  - `src/main/smoke-test.ts` runs safe packaged smoke validation without save access, watcher startup, map windows, third-party navigation, or uploads.
  - `src/main/integration-test-upload.ts` runs packaged local Electron/CDP upload validation against an explicit loopback fixture without real saves, real preferences, normal watcher startup, or third-party navigation.
  - `src/main/windows/status-window.ts` creates the local status window.
  - `src/main/windows/map-window.ts` lazily creates and reuses the remote map view, loads the map URL, and supplies DOM wait and debugger access for uploads.
  - `src/main/security/` contains window option, navigation, permission, and development resource-audit helpers for Electron security boundaries.
  - `src/main/ipc/` registers status-window-only IPC handlers and validates message senders.
  - `src/services/app-state.ts` owns serializable state snapshots, explicit third-party upload permission status, and bounded in-memory logs.
  - `src/services/preferences.ts` owns UTF-8 JSON preference persistence under Electron `userData`, schema validation, safe defaults, and atomic temp-file rename writes.
  - `src/services/revocation-marker.ts` owns the authoritative local revocation marker, marker schema validation, safe defaults, atomic temp-file rename writes, and marker removal confirmation.
  - `src/services/consent-controller.ts` owns the current disclosure version, accepted version, auto-start preference, and upload generation tokens.
  - `src/services/save-watcher.ts` owns watcher start/stop lifecycle, initial upload after watcher start, debounce, upload serialization, latest-wins coalescing, and missing-directory handling.
  - `src/services/save-uploader.ts` owns Electron Chromium upload automation through `webContents.debugger` and Chrome DevTools Protocol.
  - `src/saves.ts` resolves the default save root and recursively finds the most recently modified game `.sav` file, excluding Satisfactory server manager metadata files.
  - `src/debounce.ts` provides small debounced async task runners for coalescing rapid save events, including a cancelable variant for stop and quit cleanup.
  - `src/shared/language.ts` owns the supported language registry, default language, and Satisfactory Calculator locale URL construction.
  - `src/renderer/` contains the React, Tailwind CSS, and shadcn-style component code for the permission gate, language switcher, uploader dashboard, concise status display, and command buttons.
  - `src/renderer/i18n.ts` owns renderer-facing copy dictionaries keyed by supported application language.
  - `src/renderer/view-model.ts` selects the active renderer view and maps detailed watcher/upload state to primary user-facing status copy.
  - `src/shared/` contains serializable state and IPC contracts.
  - `forge.config.ts` configures Electron Forge Vite, ASAR, and Electron fuses for the unpacked package.
  - `electron-builder.config.cjs` configures the Windows installer, portable zip, and AppX/MSIX-family package artifacts from the unpacked package.
  - `scripts/package-paths.mjs` computes normalized Windows package and executable paths from package metadata.
  - `scripts/package-windows.mjs` creates the Electron Forge package and normalizes the unpacked package directory to the portable artifact stem.
  - `scripts/make-windows.mjs` creates installer, portable zip, or AppX artifacts from the normalized unpacked package directory.
  - `scripts/verify-package.mjs` audits the real unpacked app, GitHub release artifacts, and Store-oriented AppX artifacts.
  - `scripts/smoke-package.mjs` launches the unpacked app executable in `--smoke-test` mode.
  - `scripts/integration-package.mjs` launches the unpacked app executable in `--integration-test-upload` mode with a loopback fixture page and synthetic `.sav`.
  - `package.json` exposes `dev`, `build`, `start`, `package`, `make`, `make:installer`, `make:portable`, `make:appx`, `verify:package`, `verify:make`, `verify:installer`, `verify:portable`, `verify:appx`, `smoke:package`, `integration:package`, `lint`, `fix`, `typecheck`, `test`, `check`, and `hooks:install` scripts.
- **Interactions:** The renderer calls the preload API. The preload API invokes centralized IPC channels. IPC handlers validate the exact status-window `webContents` and sender frame, call `AppRuntimeController`, and return state snapshots. The runtime controller blocks unauthorized commands before save-root resolution. Language changes persist through preferences, update in-memory consent language, update renderer copy, and select the uploader target URL from the shared language registry. The watcher obtains an upload generation token before scanning for the latest save. The uploader validates the same token before loading the page, before setting the file input, and after file selection. The uploader validates the selected absolute `.sav` path in the main process, records the current remote-page scroll position, asks the map window to load the selected language's map page, validates expected DOM state, attaches the debugger only for file selection, sends CDP DOM commands, confirms the upload panel changes from visible to hidden, waits for the panel to return visible with the file input cleared, restores the recorded remote-page scroll position on success or failure, and detaches the debugger in `finally`. Real Satisfactory Calculator map loads run a best-effort viewport alignment script that locates the remote layout anchor `body > main > div:nth-child(2) > div:nth-child(2) > div.col-md-4.col-lg-3`, calculates the remote header height from `body > header > nav`, and scrolls with `16px` padding; local integration-test URLs are not aligned. The map page load waits for the main frame; child frame resource failures from third-party page internals do not make the map load fail. The map session uses a host resource policy: packaged production blocks non-allowlisted resource hosts without writing development logs, while development blocks with the same allow-list and writes sanitized local request metadata plus each allow/block decision. `SATISFACTORY_MAP_RESOURCE_FILTER=audit` switches development runs to audit-only logging for resource discovery. The integration-test mode reuses this uploader path with a main-process-only target URL and synthetic `.sav` supplied by the local test harness.

## Runtime Behavior

- The application opens a local status window on startup and exits when that window closes.
- The application uses a single-instance lock; a second launch restores and focuses the existing status window.
- On first launch without current third-party upload permission, the application creates only the local status window, displays only the permission gate, does not show dashboard controls, does not resolve the default save root, does not scan saves, does not start the watcher, does not create the map window, and does not load the third-party map page.
- Startup authorization first evaluates the revocation marker. A valid marker, damaged marker, unreadable marker, or uncertain marker state is treated as unauthorized. Only an absent marker allows the preferences schema and current disclosure version to authorize uploads.
- Accepting the current disclosure writes accepted preferences, verifies the accept intent is still current, clears and confirms the revocation marker is absent, verifies the intent again, then updates in-memory consent and opens the map while leaving the watcher stopped.
- Choosing Not now exits the application without persisting preferences, resolving the save root, scanning saves, starting the watcher, creating the map window, or loading the third-party map page.
- After current permission has been accepted, the app loads the map page on launch, and the watcher starts stopped for each app session.
- The permission gate and uploader dashboard expose a Globe language switcher. The selected language is persisted in preferences, controls renderer copy, updates document language metadata, and selects the Satisfactory Calculator locale URL from the shared language registry.
- Language changes before upload permission is granted persist the language preference without resolving the save root, scanning saves, starting the watcher, creating the map window, or loading the third-party map page.
- Language changes after upload permission is granted reload the map workflow with the selected locale. If a currently opened save is recorded, the application uploads that same save path again. If no currently opened save is recorded, the application reloads the map page without selecting a save.
- User Stop stops automatic file watching without revoking upload permission. User Start starts scanning/uploading for the current session only.
- The dashboard can open the local save folder through a main-process command. The command opens the directory containing the currently opened save when one is recorded, otherwise it opens the resolved default save root. The renderer cannot provide an arbitrary path.
- Revoke immediately disables in-memory upload consent, increments the upload generation, cancels pending or active upload work, stops the watcher, writes the revocation marker before map-window/session cleanup, then normalizes accepted preferences. The consent mutation queue serializes Accept and Revoke persistence while generation checks make stale operations unable to reopen the gate.
- If the revocation marker is saved, revocation remains effective across restarts even if preferences normalization fails. If marker writing fails, revoked preferences are used as a fallback persistent invalidation. If both persistent invalidation paths fail, the current process remains unauthorized and the status window reports that restart behavior cannot be guaranteed until revoke succeeds.
- Revoked or uncertain permission state displays the permission gate. The uploader dashboard is available only when upload permission is granted, and the permission gate allows the user to grant permission again or exit the app.
- If the default save root is unavailable, the status window remains open, watcher status becomes `error`, and logs show the checked directory.
- Watcher start continues monitoring when the save root exists but no game `.sav` files are present.
- Save events are debounced by approximately 2 seconds.
- Uploads are serialized. A save event during an upload is coalesced and processed after the active upload by rescanning for the latest save.
- Re-uploading the currently opened save after a language change uses the same serial upload queue when the watcher exists and does not scan for the latest save.
- Stop immediately closes the filesystem watcher, cancels pending debounce work, drops pending automatic uploads, and does not interrupt an already active upload.
- Manual upload remains available while stopped and uses the same serial upload queue.
- Application quit cancels pending timers and aborts active upload work without waiting for long website processing.
- Manual start, stop, and upload latest save actions are available from the uploader dashboard after third-party upload permission has been granted.
- The map view is created lazily after permission is granted, embedded to the right of the watcher toolbar, automatically aligned to the remote map layout anchor after real map page loads, and reused for uploads. Application shutdown destroys it.
- In packaged production runs, the map session allows resource requests only from `satisfactory-calculator.com`, `static.satisfactory-calculator.com`, and the site dependency CDN `cdn.jsdelivr.net`. Development runs use the same allow-list by default and write sanitized request metadata plus each allow/block decision to `dev-map-resource-requests.ndjson` under Electron `userData`; the log omits query strings, hash fragments, save paths, and file contents. Development can switch to audit-only logging with `SATISFACTORY_MAP_RESOURCE_FILTER=audit`.
- Upload failures update app state and logs without exiting the watcher or application.
- Successful upload state is recorded only after the map upload panel has hidden, returned visible, and cleared the selected file input.
- Operation tokens prevent stale upload completions from writing final state after shutdown.
- Hidden map-window uploads temporarily disable background throttling only for active upload work and restore it afterward.
- `--smoke-test` points Electron `userData` to a temporary directory before preferences initialization, creates only the status window, starts unauthorized, verifies the preload API plus `getState` and disclosure IPC, verifies counters for no save-root resolution, no save scan, no watcher start, no map window, no third-party URL load, and no preference write, then removes the temporary directory and exits with code `0`; failure or timeout exits non-zero.
- `--integration-test-upload` points Electron `userData` to a temporary directory before normal runtime initialization, validates that the URL is exact `127.0.0.1` loopback HTTP, validates that the synthetic `.sav` and result path stay under the test root, creates a hidden map window with an integration-only navigation policy and request filter, executes one real CDP file selection through `DOM.setFileInputFiles`, verifies fixture DOM processing, writes a bounded result JSON under the test root, cleans test user data, and exits with code `0`; failure or timeout exits non-zero.

## Security

- The status window uses `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- The map window or embedded map view uses `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, no preload, and no `webviewTag`.
- The map window or embedded map view uses a non-persistent `map` session partition and denies web permission requests and checks by default.
- Top-level map navigation and redirects are limited to the Satisfactory Calculator HTTPS origin by strict `URL` parsing. Username, password, unexpected protocol, unexpected host, and unexpected port are rejected. Subframe navigation is not blocked by the main-frame allow-list.
- Packaged map resource requests are limited to exact HTTPS hosts `satisfactory-calculator.com`, `static.satisfactory-calculator.com`, and `cdn.jsdelivr.net`; deceptive suffix hosts, HTTP, ad/analytics hosts, and other non-allowlisted third-party resources are blocked.
- Integration-test navigation uses an explicit loopback-only policy and does not change the production Satisfactory Calculator allow-list. The renderer, preferences, and normal command-line flow cannot select arbitrary map URLs or arbitrary upload paths.
- `window.open` from the map page is denied.
- Local save paths are selected only by main-process save discovery. Renderer IPC can request only "upload latest save" and cannot provide an arbitrary path.
- Renderer IPC can request only a supported application language code from the shared language registry and cannot provide an arbitrary map URL.
- Upload consent is enforced in two layers. The runtime controller prevents unauthorized watcher startup, manual upload, and map opening before save-root resolution. The uploader checks the current consent generation immediately before execution-sensitive phases so revocation cannot be bypassed by a stale queued operation.
- The main process validates that a candidate upload path is absolute, exists, is a regular file, and has a case-insensitive `.sav` extension before any CDP command runs.
- The debugger attaches without a hard-coded protocol version, attaches only while setting file input files, detaches in `finally`, and reports occupied or unexpectedly detached debuggers as upload errors.
- Electron fuses disable run-as-node, Node options environment variables, and Node CLI inspect arguments; enable cookie encryption; enable embedded ASAR integrity validation; and require loading the app from ASAR.

## Tooling

- `pnpm run dev` runs Electron Forge development startup.
- `pnpm run build` runs TypeScript typechecking without opening a GUI.
- `pnpm run start` runs Electron Forge development startup.
- `pnpm run package` creates an unpacked Windows x64 Electron package under `out/SatisfactorySaveMapUploader-Portable-<version>-x64`.
- `pnpm run verify:package` audits the unpacked package, `app.asar`, fuses, Authenticode status, source maps, forbidden artifacts, Electron version, and largest files.
- `pnpm run smoke:package` launches the real unpacked Windows executable with `--smoke-test`.
- `pnpm run integration:package` launches the real unpacked Windows executable with `--integration-test-upload`, a local synthetic `.sav`, and a loopback fixture page that reads and verifies the uploaded file contents without contacting the real map website.
- `pnpm run make` creates a Windows x64 guided installer and portable zip under `out/make`.
- `pnpm run make:installer` creates only the Windows x64 guided installer under `out/make`.
- `pnpm run make:portable` creates only the Windows x64 portable zip under `out/make`.
- `pnpm run verify:make` validates installer and portable zip names, sizes, and SHA-256 checksum files.
- `pnpm run verify:installer` validates the installer name, size, and SHA-256 checksum file.
- `pnpm run verify:portable` validates the portable zip name, size, and SHA-256 checksum file.
- `pnpm run make:appx` creates a Windows x64 AppX/MSIX-family package under `out/make` for Store validation.
- `pnpm run verify:appx` validates the AppX package name, size, and SHA-256 checksum file.
- `pnpm run lint` runs `biome ci .`.
- `pnpm run fix` runs `biome check --write .`.
- `pnpm run typecheck` runs `tsc -p tsconfig.json --noEmit`.
- `pnpm run test` runs `vitest --run`.
- `pnpm run check` runs lint, typecheck, and tests.
- `pnpm run hooks:install` runs `pre-commit install --hook-type pre-commit --hook-type commit-msg`.

## Distribution

- GitHub test builds are unsigned installer and portable zip artifacts.
- Tag builds create draft releases with unsigned artifacts and checksums.
- GitHub Actions use read-only default permissions. The tag-only draft release job uses write permission only after build, check, package verification, release artifact verification, and artifact upload complete.
- GitHub Actions use official actions pinned to full commit SHA references.
- Microsoft Store distribution is documented as a separate validation path using Electron Forge package output and AppX/MSIX-family package artifacts.
- Store identity fields are centralized in `config/app-metadata.ts` and mirrored into `electron-builder.config.cjs` for AppX package generation. The current Partner Center product identity is `MianQin.SatisfactorySaveMapUploader`, publisher `CN=DCC117A3-6615-4987-B0AD-FF45756501E3`, publisher display name `Mian Qin`, and Store ID `9PHQ2D03K6ZS`.

## Validation

- **Checks:** Automated tests cover recursive latest-save selection, metadata exclusion, debounce coalescing, app state snapshots and logs, renderer permission view selection, language registry coverage, renderer copy coverage, persisted language changes, locale-specific map URL selection, language-change re-upload of the currently opened save, watcher lifecycle, missing directory handling, serialized latest-wins uploads, stop semantics, stale upload protection, lifecycle helpers, map close/destroy behavior, background throttling, CDP command order, upload error classification, file validation, DOM readiness phases, IPC channels and sender validation, preload subscription behavior, URL allow-list boundaries, permission denial, revocation marker persistence, Accept/Revoke mutation ordering, integration-test config validation, and package verification helpers.
- **Evidence:** Local quality checks run Biome, TypeScript, and Vitest. Packaging verification runs Electron Forge package output audits, local packaged smoke tests, local packaged Electron/CDP integration tests, installer and portable zip output audits, optional AppX package output audits, checksum generation, and fuse reads against the real packaged executable. Manual validation covers real website upload behavior, default save discovery, latest save upload, map view behavior, game-save-triggered upload, application exit, clean installer operation, portable zip startup, uninstall behavior, and package inspection for absent Playwright browser artifacts.

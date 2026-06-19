---
abstract: Operator setup and usage notes for the Satisfactory save map watcher.
out_of_scope: Product requirements, implementation planning, and third-party website internals.
---

# Satisfactory Save Map Watcher

This tool watches the default Windows Satisfactory save directory and uploads the latest `.sav` file to the Satisfactory Calculator interactive map.

## Setup

```powershell
pnpm install
pnpm exec playwright install chromium
```

Install git hooks when `pre-commit` is available on `PATH`:

```powershell
pnpm run hooks:install
```

## Run

Development mode:

```powershell
pnpm run dev
```

Compiled mode:

```powershell
pnpm run start
```

`pnpm run start` builds `dist` before launching the watcher.

## Check

```powershell
pnpm run check
```

## Manual Validation

Start the tool, confirm one Chromium page opens on the interactive map, and confirm the newest `.sav` under `%LOCALAPPDATA%\FactoryGame\Saved\SaveGames` is uploaded. Save the game or overwrite a `.sav` file and confirm the same browser page uploads the newest save again after about 2 seconds.

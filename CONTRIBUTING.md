# Contributing

Thanks for considering a contribution to Satisfactory Save Map Uploader.

This project accepts issues and pull requests, but changes are merged only after maintainer review.

## Before You Start

- Open an issue first for larger behavior, packaging, privacy, or UI changes.
- Keep changes small and focused.
- Do not attach real save files. If a save-related reproduction is required, describe the behavior or use a minimized synthetic fixture.
- Do not upload someone else's `.sav` file to a third-party site during testing.

## Development

Install dependencies:

```powershell
pnpm install
```

Run the local app:

```powershell
pnpm run dev
```

Run the required checks:

```powershell
pnpm run check
```

For packaging changes, also run the relevant package verification command from `package.json`.

## Pull Requests

- Use a branch, not direct commits to `main`.
- Use concise commit messages in the form `type(scope): summary`.
- Update tests for behavior changes.
- Update README, privacy, security, or specs when the user-facing behavior changes.
- Include screenshots for visible UI changes.
- Call out any privacy or upload behavior changes clearly in the PR description.

The maintainer may squash commits when merging, so the final merge commit title must also follow `type(scope): summary`.


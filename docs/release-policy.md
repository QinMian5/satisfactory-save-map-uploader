---
abstract: Release channel, signing, and artifact provenance policy for desktop builds.
out_of_scope: Runtime application behavior, Store listing text, and vulnerability intake procedures.
---

# Release Policy

## CI

Pull requests and pushes run with default `contents: read` permission. Windows CI runs install, checks, build validation, Electron packaging, and package verification because the product targets Windows.

## GitHub Beta Builds

GitHub beta and test package artifacts are unsigned AppX/MSIX-family packages. Unsigned AppX artifacts are for build verification and may be blocked by Windows installation policy on a clean machine until a trusted signature is available. Build artifacts must come from GitHub Actions and must be traceable to the source commit.

## GitHub Tag Releases

Version tags use the `vX.Y.Z` format and must match `package.json` version `X.Y.Z`. Tag workflows validate the version, install dependencies, run checks, build, package, verify the package, make the AppX package, verify AppX artifacts, generate SHA-256 checksums, upload a workflow artifact, and then create a draft release from a separate job with `contents: write` permission. Draft releases are not automatically published.

Workflow dispatch builds upload Actions artifacts only and do not create GitHub Releases.

## Public Release Acceptance

Public releases must require explicit first-run permission before any Satisfactory `.sav` file is provided to a third-party website. The unauthorized startup path must not scan saves, start the watcher, create the map window, or load the Satisfactory Calculator page. Revocation must be available from the status window and must remain effective across restarts unless the user accepts the disclosure again.

Release Candidate validation includes `pnpm run integration:package` on a local Windows environment. The command uses a synthetic `.sav`, a loopback fixture, and the packaged Electron executable. It is not required in GitHub hosted CI until the GUI integration path is proven stable there.

## Signing

Public release packages must be signed before distribution. Microsoft Store MSIX/AppX distribution uses Store-managed signing after certification and does not require a reusable certificate from Partner Center. Store-external distribution, including GitHub Release artifacts, still requires a signing service or certificate. Signing for Store-external release artifacts is expected to use Azure Artifact Signing once release credentials and GitHub Actions OIDC are configured. The release workflow must fail closed: failed signing or failed signature verification prevents publication of signed release artifacts.

## Microsoft Store

The Store route is a separate validation path. Store signing applies only to Store-distributed packages and does not sign GitHub Release AppX/MSIX artifacts.

---
abstract: Manual acceptance checklist for real website uploads and clean Windows package validation.
out_of_scope: Automated CI validation, code signing setup, Store submission, auto-updates, tray behavior, and release publication.
---

# Manual Acceptance

Run these checklists only when you intentionally want to validate behavior that automated tests do not cover.

## A. Real Website Upload Test

This test provides a `.sav` file to the third-party Satisfactory Calculator website. Run it only after deciding that the selected save can be processed by that site. Do not default to a sensitive or only copy of a save; copy a test save first when possible.

1. Start the current unpacked packaged app using a fresh user profile or cleared preferences.
2. Confirm the first launch shows only the permission gate and does not show dashboard controls, a save directory, logs, or the embedded map area.
3. Confirm the first launch does not scan saves, start the watcher, create the embedded map view, or open the map page.
4. Click Not now, exit and confirm the app exits without uploading or saving permission. Relaunch with the same fresh profile.
5. Click Allow uploads and confirm the dashboard and embedded map appear while the watcher remains stopped and no save directory is resolved yet.
6. Click Start and confirm the default save directory appears only after Start.
7. Confirm the initial latest `.sav` upload succeeds and the right-side embedded map shows the expected map.
8. Save the game again while another app has focus and confirm the background upload succeeds.
9. Confirm the background upload does not steal focus from the active app.
10. Trigger several quick saves or copied `.sav` writes and confirm only the latest save is processed after debounce.
11. Force an upload failure and confirm the watcher keeps running.
12. Click Stop, restart the app, and confirm watcher remains stopped.
13. Click Start, restart the app, and confirm watcher starts stopped until Start is clicked again.
14. While stopped, click Upload latest save and confirm manual upload still works after permission has been granted.
15. Click Disable uploads and confirm later automatic uploads stop.
16. Restart after revoke and confirm the permission gate appears before any scan or upload.
17. Simulate a preferences write failure during revoke and confirm the old authorization does not silently recover on restart.
18. Corrupt the preferences file while revoked and confirm the app safely returns to the unauthorized state.
19. Click Allow uploads again after revoke, then click Start and confirm uploads resume only after local revoked state is cleared.
20. Run `pnpm run integration:package` and confirm the local synthetic Electron/CDP upload test succeeds without real saves or real website access.
21. Start an upload, click Disable uploads, and confirm the message accurately distinguishes whether the file may already have been provided to the third-party page.
22. Disconnect the network and confirm the app reports a clear page-load or upload error.
23. If the website changes selectors, confirm the app reports a clear selector or DOM-state error instead of crashing.
24. Close the main status window and confirm all app, Electron, Chromium, and Node processes exit.

## B. AppX/MSIX Clean Environment Test

Prefer Windows Sandbox or a separate Windows VM. The tester should not need Node.js, pnpm, Playwright, or a separate Chromium installation.

Windows Sandbox is optional. If enabled, copy the generated package into the sandbox and run it there. A minimal `.wsb` file can map the local maker directory:

```xml
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>D:\Code\satisfactory\out\make\appx</HostFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <Networking>Enable</Networking>
</Configuration>
```

Unsigned AppX packages are expected to be install-blocked on a clean machine unless a trusted signing certificate is present. Record that result and stop this section until a signed package is available.

1. Copy `SatisfactorySaveMapUploader-0.1.0-x64.appx` and its `.sha256` file into a clean Windows environment without Node or pnpm.
2. Verify the package SHA-256 checksum.
3. Record Windows App Installer, SmartScreen, and Defender behavior.
4. If the package is unsigned, confirm Windows blocks installation or requires a trusted certificate, then stop this section.
5. Install the signed package without installing Node, pnpm, Playwright, or Chromium development dependencies.
6. Confirm installation does not require administrator permission unless a local test certificate is being trusted for the test.
7. Confirm the Start menu shortcut is present and launches the app.
8. Confirm the application name and version are correct.
9. Launch once and confirm only one app instance is running.
10. Double-click the shortcut repeatedly and confirm the existing status window is focused instead of creating a second watcher.
11. Run the real upload checklist items that are appropriate for the test environment.
12. Confirm the map is embedded in the main window and no separate map window is opened.
13. Close the main status window and confirm no app, Electron, Chromium, or Node processes remain.
14. Relaunch the app and confirm it starts normally.
15. Uninstall the app successfully.
16. After uninstall, confirm no app process remains.
17. Check the user profile for cache, session, shortcut, and package remnants. Electron cache and user preferences may remain under the user profile after uninstall; record them instead of treating every user-data remnant as an install failure.
18. Inspect the package contents or installation directory and confirm it does not contain Playwright Chromium, `ms-playwright`, `.local-browsers`, `chrome-win`, `playwright`, or `@playwright`.

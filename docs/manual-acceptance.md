# Manual Acceptance

Run these checklists only when you intentionally want to validate behavior that automated tests do not cover.

## A. Real Website Upload Test

This test provides a `.sav` file to the third-party Satisfactory Calculator website. Run it only after deciding that the selected save can be processed by that site. Do not default to a sensitive or only copy of a save; copy a test save first when possible.

1. Start the current unpacked packaged app using a fresh user profile or cleared preferences.
2. Confirm the first launch shows only the permission gate and does not show dashboard controls, a save directory, logs, or the embedded map area.
3. Confirm the first launch does not scan saves, start automatic upload, create the embedded map view, or open the map page.
4. Click Not now, exit and confirm the app exits without uploading or saving permission. Relaunch with the same fresh profile.
5. Click Allow uploads and confirm the dashboard and embedded map appear while automatic upload remains stopped and no save directory is resolved yet.
6. Click Start automatic upload and confirm the default save directory appears only after that action.
7. Confirm the initial latest `.sav` upload succeeds and the right-side embedded map shows the expected map.
8. Save the game again while another app has focus and confirm the background upload succeeds.
9. Confirm the background upload does not steal focus from the active app.
10. Trigger several quick saves or copied `.sav` writes and confirm only the latest save is processed after debounce.
11. Force an upload failure and confirm automatic upload stays enabled.
12. Click Pause automatic upload, restart the app, and confirm automatic upload remains stopped.
13. Click Start automatic upload, restart the app, and confirm automatic upload starts stopped until Start automatic upload is clicked again.
14. While automatic upload is paused, click Upload latest save and confirm manual upload still works after permission has been granted.
15. Click Disable uploads and confirm later automatic uploads stop.
16. Restart after revoke and confirm the permission gate appears before any scan or upload.
17. Simulate a preferences write failure during revoke and confirm the old authorization does not silently recover on restart.
18. Corrupt the preferences file while revoked and confirm the app safely returns to the unauthorized state.
19. Click Allow uploads again after revoke, then click Start automatic upload and confirm uploads resume only after local revoked state is cleared.
20. Run `pnpm run integration:package` and confirm the local synthetic Electron/CDP upload test succeeds without real saves or real website access.
21. Start an upload, click Disable uploads, and confirm the message accurately distinguishes whether the file may already have been provided to the third-party page.
22. Disconnect the network and confirm the app reports a clear page-load or upload error.
23. If the website changes selectors, confirm the app reports a clear selector or DOM-state error instead of crashing.
24. Close the main status window and confirm all app, Electron, Chromium, and Node processes exit.

## B. Installer And Portable Clean Environment Test

Prefer Windows Sandbox or a separate Windows VM. The tester should not need Node.js, pnpm, Playwright, or a separate Chromium installation.

Windows Sandbox is optional. If enabled, copy the generated release artifacts into the sandbox and run them there. A minimal `.wsb` file can map the local maker directory:

```xml
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>D:\Code\satisfactory\out\make</HostFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <Networking>Enable</Networking>
</Configuration>
```

Unsigned installers and portable zips can trigger Windows SmartScreen or Defender warnings. Record the exact prompt instead of treating every warning as a functional failure.

1. Copy `SatisfactorySaveMapUploader-Installer-0.2.0-x64.exe`, `SatisfactorySaveMapUploader-Portable-0.2.0-x64.zip`, and their `.sha256` files into a clean Windows environment without Node or pnpm.
2. Verify each SHA-256 checksum.
3. Record Windows SmartScreen and Defender behavior for the installer and the portable zip.
4. Run `SatisfactorySaveMapUploader-Installer-0.2.0-x64.exe`.
5. Confirm the installer shows a guided setup flow and allows selecting an installation directory.
6. Confirm installation does not require administrator permission.
7. Confirm the Start menu shortcut is present and launches the app.
8. Confirm the application name and version are correct.
9. Launch once and confirm only one app instance is running.
10. Double-click the shortcut repeatedly and confirm the existing status window is focused instead of creating a second automatic upload process.
11. Run the real upload checklist items that are appropriate for the test environment.
12. Confirm the map is embedded in the main window and no separate map window is opened.
13. Close the main status window and confirm no app, Electron, Chromium, or Node processes remain.
14. Relaunch the installed app and confirm it starts normally.
15. Uninstall the app successfully.
16. After uninstall, confirm no app process remains.
17. Check the user profile for cache, session, shortcut, installer, and application data remnants. Electron cache and user preferences may remain under the user profile after uninstall; record them instead of treating every user-data remnant as an install failure.
18. Inspect the installation directory and confirm it does not contain Playwright Chromium, `ms-playwright`, `.local-browsers`, `chrome-win`, `playwright`, or `@playwright`.
19. Extract `SatisfactorySaveMapUploader-Portable-0.2.0-x64.zip` in a clean folder.
20. Run `SatisfactorySaveMapUploader.exe` from the extracted portable folder.
21. Confirm the portable app starts without installation and uses the same first-run permission behavior.
22. Close the portable app and confirm no app, Electron, Chromium, or Node processes remain.

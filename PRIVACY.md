---
abstract: Privacy disclosure for local save access and third-party map processing.
out_of_scope: Security vulnerability handling, release policy, and Store submission metadata.
---

# Privacy

Satisfactory Save Map Watcher asks for explicit third-party upload permission before it scans local Satisfactory `.sav` files, opens the Satisfactory Calculator map page, or uploads a save.

The application itself does not include analytics or telemetry. The application developer does not receive, store, or process your save files.

The application loads the third-party website `https://satisfactory-calculator.com/zh/interactive-map` inside an Electron map window. When an upload runs, the application actively provides your selected `.sav` file to that third-party web page for processing. The website can read the provided file contents, file name, related file metadata exposed by the browser upload flow, network information, and any data its web page normally collects.

The Satisfactory Calculator website has its own privacy policy and terms. Those policies apply independently from this project.

## Permission Storage

The app stores small local permission state under Electron's per-user application data directory from `app.getPath("userData")`. It stores the preferences schema version, the accepted disclosure version, whether automatic watcher startup is enabled, an optional acceptance timestamp, and local revocation state. It does not store save contents, analytics identifiers, cloud account data, or a selected save path.

If local permission storage is missing, damaged, unreadable, contains an old disclosure version, or has an uncertain revocation state, the app uses a safe default: permission is treated as missing, the watcher stays stopped, saves are not scanned, uploads do not run, and the third-party map page is not loaded automatically.

## Revocation

You can revoke third-party upload permission from the status window. Revocation stops future automatic uploads, records local revoked state for future restarts, clears the saved disclosure acceptance when possible, disables watcher auto-start, cancels pending work, and hides or destroys the map window.

If local storage fails during revocation, the current app session remains unauthorized and future uploads stay blocked. The status window reports whether revocation was saved for restart or whether you should retry revoke before exiting.

If revocation happens before a file is provided to the third-party page, that pending upload is cancelled. If a file was already provided to the third-party page, revocation cannot take that data back; it only blocks later uploads.

V1 logs are kept only in memory in the status window. They are not persisted by this application and disappear when the app exits.

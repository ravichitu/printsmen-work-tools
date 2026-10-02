# Update Manager

Version 0.7.0 bundles a separate Start Menu **Update Manager** shortcut and
`Start Update Manager.cmd`. It opens a dedicated local application page using
the same bundled runtime and operator sign-in as the studio.

## Automatic Behaviour

- Checks on startup and every six hours while the studio server runs.
- Downloads only an owner-signed, newer preview release from HTTPS, with no
  redirects. Verifies the Ed25519 signature, exact byte count and SHA-256 digest.
- Installs automatically only after all editor tabs are closed and five minutes
  with no studio activity. Badge Designer and PrintsMen editor tabs always block
  automatic installation, even if their work appears saved. Suspended tabs also
  block installation rather than being assumed closed.
- The studio need not be visible, but its local server must be running. This is
  not a Windows service or an update task that runs while the computer is off.
- Check Now, Download and Install Now are also available. Manual installation
  requires an explicit confirmation that work has been saved.
- Installation rechecks the downloaded installer hash. An update preserves the
  preview installation identity, operator settings, update configuration and
  unrecognised user files. It never invokes uninstall or retires a licence.
- Existing owned files are backed up during update. Ordinary application-copy
  errors trigger rollback. A power loss or failed rollback leaves `.update-pending`
  for owner recovery and the app refuses to open tools. Do not delete that backup.
- Browser jobs remain in the same browser origin (127.0.0.1:4188 for the preview).
  Export job backups before updating. PrintsMen jobs do not have autosave.

## Hosting Status

Release hosting is not configured. The manager explicitly reports this and makes
no update download requests until the owner supplies an HTTPS feed. The update
verification public key can be pinned before hosting is selected. Only public
configuration is distributed; no signing private key is in the installer.

Owner-only release commands, from the separate PrintsMen Licence Manager folder:

```powershell
node update-releases.mjs init
node update-releases.mjs configure --offline
# Later, configure HTTPS hosting and rebuild/distribute its public configuration:
node update-releases.mjs configure https://YOUR-HOST/printsmen/latest.json
node update-releases.mjs publish PATH-TO-SETUP.exe 0.7.1 https://YOUR-HOST/printsmen/setup-0.7.1.exe NEW-signed-update.json "Release notes"
```

The private signing key is DPAPI-protected under the owner utility's `private/`
directory. Back up the owner account securely; a Windows account change can make
DPAPI data inaccessible. Do not rotate this key casually: installed applications
trust the pinned public key. A changed feed address or key must be distributed
by the owner, not entered by operators into a download dialog.

## Limits

- Preview channel only. This installer is not an upgrade of the separate managed
  licensing prototype. Production activation and enforced per-tool licensing are
  still pending; enabling updates does not add DRM.
- The outer setup EXE is not Authenticode-signed. The update feed signature verifies
  future downloads, but first-install Windows trust/reputation needs a separate
  code-signing certificate.
- Owner HTTPS hosting, publishing a real later release and a full visual browser
  check remain required before calling the online update system production-ready.

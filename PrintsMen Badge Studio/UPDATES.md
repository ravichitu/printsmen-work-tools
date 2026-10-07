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

GitHub Releases is now the prepared update transport. The application points to
the stable HTTPS asset URL:

```text
https://github.com/ravichitu/printsmen-work-tools/releases/latest/download/printsmen-update.json
```

The manager follows GitHub's release-asset redirects, then verifies the signed
Ed25519 envelope, installer byte count and SHA-256 before it can install. Only
public configuration is distributed; no signing private key is in the installer.

The repository workflow at `.github/workflows/release-preview.yml` runs on a
matching `vX.Y.Z` tag. It tests the app, builds the installer and portable ZIP,
creates `printsmen-update.json`, and publishes all three as GitHub Release
assets. Configure the repository's protected `printsmen-release` environment
with the secret `PRINTSMEN_UPDATE_PRIVATE_KEY`, containing the Ed25519 PKCS#8
private PEM that matches the public key pinned in `updates-config.json`. Keep
that secret owner-only and require environment approval for release runs.

The workflow is intentionally tag-driven: ordinary branch pushes do not ship an
installer. Push the code, review it, then create and push a matching tag such as
`v0.9.6`. The current 0.9.5 installer was built before this GitHub feed was
configured, so it needs one manual install of a later GitHub-enabled release;
subsequent releases can update automatically while the studio is idle.

Owner-only release commands, from the separate PrintsMen Licence Manager folder:

```powershell
node update-releases.mjs init
node update-releases.mjs configure --offline
# For the GitHub workflow, configure the same public key and feed URL locally:
node update-releases.mjs configure https://github.com/ravichitu/printsmen-work-tools/releases/latest/download/printsmen-update.json
# Manual owner publishing remains available when a release is not built by Actions:
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

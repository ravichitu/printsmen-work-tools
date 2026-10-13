# Faster upgrade builds

The current combined application is on the repository's `master` branch.
The workflows live at the repository root, in `.github/workflows/`.

## Local checks

From `PrintsMen Badge Studio`, run:

```powershell
npm run check
```

This checks release inputs, script syntax (including embedded page scripts),
the public update configuration and release version. It does not decode customer
artwork or create an installer. For the full regression suite, run:

```powershell
npm run verify
```

## Automatic installer builds

A source push to `master` runs preflight checks and the complete test suite.
Only after they pass does GitHub build a portable ZIP and Windows preview
installer. Download them from the workflow run's Artifacts section. Each build
includes SHA-256 checksums and the exact source commit in SOURCE-REVISION.json.
Artifacts are kept for 14 days. Pull requests run checks without obtaining
preview credentials or packaging an installer.

The `PRINTSMEN_OPERATOR_CONFIG` repository secret contains the existing preview
operator's salted hash configuration. It is not a plaintext password, licence
signing key or owner dashboard credential. The build validates it and writes
only the fields needed by the preview sign-in. Existing local configurations
cannot be overwritten by this setup script.

Manual rebuilds are available under Actions > Check and build PrintsMen preview.

## Publishing updates to installed applications

Build artifacts and installed-app updates are separate. A release tag matching
package.json calls the same tested build, then signs and publishes the update
feed and installer. The publishing job needs the existing Ed25519 private key
as `PRINTSMEN_UPDATE_PRIVATE_KEY` in the `printsmen-release` environment. Its
derived public key must match updates-config.json; the signer rejects a mismatch.

The owner key stays local until the owner configures that publishing secret.
Successful builds remain downloadable without it. No licence authority secrets
are needed for a preview build.

After a real signed release is published, applications with a configured feed
can check/download it and install after every editor is closed and the studio
has been idle for five minutes. A source push alone never installs unreviewed
code on customer computers. The preview installer still does not enforce
production licensing.

Updates preserve each installation's existing update configuration. If an older
installation has an empty feed, an owner must configure that installation before
automatic checks can work; installing a newer EXE alone does not change its feed.

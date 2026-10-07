# PrintsMen 0.9.6 Release Notes

This release prepares GitHub Releases as the owner-controlled update channel
and raises the shared import/output ceiling from 500 to 1,000 items.

## Included

- 1,000-file import ceiling for legacy tools and Custom Size.
- 1,000-job sequential production queue with the same memory and pixel guards.
- GitHub Releases `latest` update-feed URL with signed Ed25519 verification.
- GitHub Actions workflow for tests, package, installer, signed feed and release assets.
- CI-only update-feed signer; no private signing key is stored in the repository or installer.
- GitHub release redirects are followed only for signed feed and installer URLs; byte count and SHA-256 are checked before installation.

## First release setup

1. Add the Ed25519 PKCS#8 private key matching `updates-config.json` as the protected GitHub Actions secret `PRINTSMEN_UPDATE_PRIVATE_KEY`.
2. Require approval for the `printsmen-release` environment.
3. Push a tag matching `package.json`, for example `v0.9.6`.
4. Confirm the workflow publishes `printsmen-update.json`, the installer and the portable ZIP.

Authenticode signing is intentionally deferred. The update feed remains
cryptographically signed, but Windows may show an untrusted publisher warning
until a code-signing certificate is added.

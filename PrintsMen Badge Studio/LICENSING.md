# Local licensing prototype (0.6.0)

## Agreed behavior

- No Supabase. The owner-controlled activation authority is separate from operators.
- The owner dashboard generates a unique key for a customer and selected tools.
  Only its hash is retained; the full key is shown once.
- Initial activation requires the configured HTTPS authority and explicit owner
  approval. Internet connectivity alone is NOT approval. No offline file-import
  activation endpoint is provided.
- An Ed25519 signed receipt binds the installation ID, Windows identity hash,
  request challenge, allowed tools, customer and approval timestamp.
- The client verifies the receipt before saving it, then reports confirmation.
  Dashboard timestamps distinguish received, approved and client-confirmed.
- This is an installation-lifetime licence, not a periodically self-issued renewal.
  Approved installations continue offline. No expiry is fabricated or extended.
- A key is permanently bound on approval. Managed uninstall retires the installation.
  Reinstall gets a fresh ID/challenge and requires a new key and owner approval.

## Separate dashboards

The studio's activation.html shows its own installation status and allowed tools.
It cannot generate keys or approve itself. The separate PrintsMen Licence Manager
contains the owner dashboard. NEVER ship that folder or its private directory to
operators. No production online authority has been configured or deployed.

The source workspace deliberately remains an unlocked development copy. The owner
build-managed.mjs creates an operator payload using managed-server.mjs as its ONLY
server.mjs entry point. Missing/corrupt authority or installation data fails closed.

## Managed Windows setup

The FIRST installer is explicitly a LOCAL PREVIEW, by user choice. It has a compiled
NSIS setup/uninstaller, bundled Node.js and temporary operator login, but deliberately
does NOT require a production licence. The owner utility is excluded. This preview
is distinct from the managed activation package described below. Its uninstaller
stops only its own running server and removes only installer-owned files.
The preview uses localhost port 4188 by default, separate from the source tool on
4178. Session cookies are installation-specific, so the two do not sign each other
out. The temporary operator credentials are supplied separately by the owner.

First configure the owner authority, deploy it behind HTTPS, and build an installer
for that authority URL. Setup.cmd requires Node.js 22+; it is NOT a compiled/signed
EXE or MSI and does not bundle Node.js.

Setup installs under %LOCALAPPDATA%\Programs\PrintsMen Badge Studio and registers an
Apps & Features uninstall command in HKCU. The ledger is outside the app under
%LOCALAPPDATA%\PrintsMen\BadgeStudioLicence, protected by Windows DPAPI for the current
Windows account. The server must run as that account. Changing Windows/account
requires recovery and approval. Uninstall retires the licence before removing only
manifest-owned files; the retirement ledger, unrecognised files and browser storage
are preserved. Export browser projects before uninstalling. No active job is saved.

Do not delete the folder manually. Setup refuses an existing target and refuses
to replace a live installation identity. If uninstall is interrupted, keep the
ledger and contact the owner. Installer hashes detect accidental corruption; the
manifest is NOT cryptographically signed yet. An update installer is not included.

## Security limits

- Servers remain loopback-only. No firewall/network settings were changed. A single
  temporary operator account now has server-side sign-in, password hashing, session
  cookies and logout. Ten separate accounts, LAN access and seat enforcement remain.
- Badge vs PrintsMen workspace access is server-gated. Individual PrintsMen tools
  share one HTML/JavaScript application; their selected-tool restrictions currently
  apply to the interface only. Altering client code can bypass them. Strong per-tool
  licensing needs isolated export/processing logic behind server permissions.
- Source files, old ZIPs and development copies are not retroactively protected.
  Administrators can patch code or restore whole Windows/state snapshots. This is
  NOT tamper-proof DRM and is not ready to sell as production copy protection.
- Already loaded browser editors/exports do not instantly stop after uninstall.
  New HTTP requests/reloads are gated. Backend export enforcement is still pending.
- Offline installs cannot be immediately revoked. Confirmation is client-reported,
  not hardware attestation or proof of continuing live usage.
- Authority timestamps use UTC and need a synchronised server clock. The dashboard
  also shows the viewing browser's local timezone.
- Owner state uses an exclusive lock and atomic replacement, intended for ONE
  authority process. Production needs a transactional database, recovery/rotation,
  verified backups, admin security review, monitoring and rate-limit tuning.
- Signed updates, public HTTPS hosting, hardened per-tool enforcement and full
  live-browser verification are unfinished. No production licence was applied.

## Verification

Run node --test tests/*.test.mjs. Tests use temporary identities and signing keys;
they do not activate the real tool, install into Programs, change registry settings,
or contact a production authority. Owner integration tests require the sibling
PrintsMen Licence Manager source folder and skip if it is not distributed.

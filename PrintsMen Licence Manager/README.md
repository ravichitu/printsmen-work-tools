# PrintsMen licence owner dashboard

OWNER ONLY: keep this utility separate from operator/customer packages.
No Supabase or other hosted service is configured.

Client details, printable licence sheets and one-use owner-controlled reinstall
recovery are now available. Read [CLIENT-RECOVERY.md](CLIENT-RECOVERY.md) before
issuing keys. Recovery keys belong only on the separate owner sheet.

## Run locally

1. Keep this folder beside PrintsMen Badge Studio; shared licence code is imported.
2. Run Start Owner Dashboard.cmd on your Windows owner computer with Node.js 22+.
3. Choose a private owner password of at least 14 characters in the terminal. Input
   is hidden; the password is never written to source code.
4. Open http://127.0.0.1:4290 and sign in. Select the customer and allowed tools,
   generate a unique key, and give it only to the intended customer.
5. Review the installation request before approving. Received, approved and
   client-confirmed timestamps are displayed in local time and authority UTC.

This is a local test environment. Shipping operator packages require an HTTPS
authority; no production HTTP/localhost bypass is included. Tests use an injected
loopback transport and ephemeral keys. Normal installs cannot activate until hosted.

Keys are shown once and stored only as hashes. Approval binds a key permanently;
reinstall requires a fresh key and approval. Reject is available before approval.
There is no misleading instant offline revoke. Owner login is not operator login.

## State and backups

private/authority.dpapi holds the signing key, password hash, keys and audit records,
encrypted with Windows DPAPI for this Windows account. Never commit/email/distribute
it. Losing this account and its protected state may prevent new approvals for
existing installs without a verified backup. Portable encrypted export/verify/restore
and owner authenticator MFA with one-use recovery codes are available; see
[SECURITY-AND-RECOVERY.md](SECURITY-AND-RECOVERY.md). A real replacement-host restore
drill, backup retention and signing-key rotation procedures still require operational
sign-off. No private key goes to operators.

## Hosting later

The owner dashboard binds 127.0.0.1:4290. The separate activation-only listener
requires confirmed owner MFA before public activation. Hosting needs an owner-controlled server, HTTPS
reverse proxy, PRINTSMEN_AUTHORITY_ORIGIN configuration, firewall rules, clock sync,
durable storage and security review. DPAPI currently targets Windows; Linux hosting
needs a server-side secret-storage adapter. Do not expose this prototype as a
finished service or use a temporary tunnel to bypass production setup.

After HTTPS hosting and security checks, build the operator installer:

```text
node build-managed.mjs https://YOUR-ACTIVATION-DOMAIN C:\ABSOLUTE\NEW-OUTPUT-FOLDER
```

The output includes Setup.cmd and an allowlisted payload containing only the PUBLIC
verification key. It requires Node.js and is not a signed EXE/MSI. The destination
must be new. The development server entry, owner utility, private keys, authority
records, tests and customer artwork are excluded.

## Production limits

The catalogue includes Customised Studio and 20 PrintsMen tools. Workspace access is
server-gated; individual tools in the legacy shared HTML currently have interface
restrictions, not tamper-proof isolation. Do not sell this as production per-tool
copy protection until protected processing is moved behind server permissions.
Read the application's LICENSING.md for full limitations.

The prototype caps at 500 keys / 1000 requests. Use one authority process. Production
needs a transactional database, monitoring and verified recovery operations.
Implemented MFA and encrypted backups must be configured and tested by the owner
before production use; their presence is not a deployment security certification.
No deployment, firewall change, repository push or real activation was performed.

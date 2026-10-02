# Owner security and recovery

The owner utility is separate from operator installers. Never distribute its
private directory, encrypted backups, signing secrets or owner recovery codes.
The application preview remains unlocked; this utility does not turn it into
a production-secured release by itself.

## Owner setup

Use the local owner dashboard Security section to enrol an authenticator.
Enrolment takes effect only after confirming a valid six-digit code. Keep the
ten one-use owner recovery codes offline. They recover owner sign-in; they are
NOT the client reinstall recovery keys printed/issued through client licensing.
Changing the owner password invalidates existing owner sessions. Codes reject
replay; keep the host clock accurate. The bounded audit list is not an external,
tamper-evident security log.

Public activation runs on a separate activation-only listener. It refuses
public activation without confirmed owner MFA. The owner listener is local;
do not proxy owner routes. No domain, TLS proxy, firewall opening or internet
deployment has been configured by this work.

## Portable encrypted backup

From this directory, in an interactive terminal:

```text
node backup-tool.mjs export C:\OwnerBackups\printsmen-NEW.encrypted.json
node backup-tool.mjs verify C:\OwnerBackups\printsmen-NEW.encrypted.json
node backup-tool.mjs restore C:\OwnerBackups\printsmen-NEW.encrypted.json C:\OwnerRestore\NEW-private
```

Use fresh destination names. Export asks for the owner password, authenticator
or recovery code if enabled, and a separate backup passphrase of 16+ characters.
Passwords must never be passed in command arguments, environment variables or
chat messages. Backup contains both licence authority and, when present, update
signing state. Encryption is AES-256-GCM with a bounded scrypt-derived key.
Store the passphrase separately from the encrypted file.

Restore decrypts into a NEW directory protected for the current Windows account.
It never overwrites or starts the live authority. It asks for a new owner
password, resets MFA and old owner recovery codes, and leaves public activation
blocked until new MFA enrolment. Keep the original host stopped before changing
the live state directory. Preserve current state separately and reconcile any
keys/activations issued since the backup; do not run two independent authorities
from the same restored signing identity.

Cryptographic backup and cross-protection tests pass with test stores. A real
replacement-host Windows-account restore drill, operational retention policy,
offsite copies, monitoring and recovery sign-off remain required. No real owner
password, MFA enrolment or production state was changed by the automated tests.

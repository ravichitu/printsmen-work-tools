# Offline activation and installation register

Managed installations now support an owner-approved file exchange. Preview builds
remain previews and do not silently become licensed builds.

1. In Activation, enter the client name, licence key and matching contact details.
   Sign in with the local operator account created for that offline managed package;
   this login does not itself grant licensed tool access.
2. Accept the data notice and download the activation request. Transfer it privately
   to the owner: it includes the licence key, installation challenge and device hash.
3. In the owner dashboard, import the request and approve the installation.
4. Download its approval and import it on the client's Activation page.
5. Download the client confirmation and import it in the owner dashboard.

The Activation dashboard records when the licence was applied locally. The owner
can compare that device-clock time with the authority's approval and confirmation
timestamps. The local timestamp is operational information, not proof against a
changed device clock. Older installations may not have an apply timestamp.

Approvals use the existing Ed25519 signature and installation/device binding.
Reinstallation still requires owner approval. Expiry currently uses the device
clock; clock rollback protection and recurring online leases are not implemented.
An offline approved copy cannot be revoked immediately while disconnected.

The register counts distinct client names, registered installations, pending,
approved, expired and client-confirmed records. Last reported is the authority's
receipt timestamp, not evidence of current live usage. Name counts are not a
substitute for unique customer account IDs. No artwork, uploaded files or passwords
are collected. This update does not introduce background telemetry.

Supabase sign-in and register sync are implemented, but require the three SQL
migrations and an active owner profile. Online activation still requires a hosted
HTTPS owner authority. Periodic online renewal/grace and production clock rollback
protection are not implemented. There is no reliable count of unreported or
unlicensed copies.

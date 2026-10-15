# Offline activation and installation register

Managed installations now support an owner-approved file exchange. Preview builds
remain previews and do not silently become licensed builds.

1. In Activation, enter the client name, licence key and matching contact details.
2. Accept the data notice and download the activation request. Transfer it privately
   to the owner: it includes the licence key, installation challenge and device hash.
3. In the owner dashboard, import the request and approve the installation.
4. Download its approval and import it on the client's Activation page.
5. Download the client confirmation and import it in the owner dashboard.

Approvals use the existing Ed25519 signature and installation/device binding.
Reinstallation still requires owner approval. Expiry currently uses the device
clock; clock rollback protection and recurring online leases are not implemented.
An offline approved copy cannot be revoked immediately while disconnected.

The register counts distinct client names, registered installations, pending,
approved, expired and client-confirmed records. Last reported is the authority's
receipt timestamp, not evidence of current live usage. Name counts are not a
substitute for unique customer account IDs. No artwork, uploaded files or passwords
are collected. This update does not introduce background telemetry.

Still pending: Supabase accounts and hosting, periodic online renewal/grace,
consented preview installation registration and automatic status reporting,
installer registration screens and production clock rollback protection.
There is no reliable count of unreported/unlicensed copies.

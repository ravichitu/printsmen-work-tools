# Client Keys, Licence Sheets And Recovery

This is the owner-only local implementation. Run `Start Owner Dashboard.cmd`
beside the current PrintsMen Badge Studio folder. On first run, choose your own
private owner password in the terminal. Test passwords are not real owner accounts.
Never distribute this owner folder or its `private` directory to clients.

## Issue A Key

Enter company/client name, contact person, phone, email, postal address and customer
reference. Select the allowed tools. Leave expiry blank for installation lifetime,
or choose an expiry date (valid through that UTC date). Each key allows exactly one
installation. Generate separate keys for additional computers.

Open the client licence sheet and use Print / Save PDF. It includes the supplied
details, key, record ID, tools, installation count, validity and activation timestamps.
Client details may be printed later, but the full licence key is shown only when
issued; the authority stores its hash. Store the issue-time document securely.

The separate OWNER RECOVERY sheet contains a one-use recovery key. Do not send it
with the client licence sheet. Only hashes of licence and recovery keys are stored
in the DPAPI-protected authority ledger. Losing a sheet does not provide an admin
password reset or a way to recover the private signing key.

## Activation And Reinstallation

In the managed application's activation page, the customer enters the licence key,
client name and the phone/email recorded on the sheet. The authority checks these
against the issued record before creating an approval request. Name comparison
ignores letter case and repeated whitespace; phone comparison ignores punctuation.
These are record-matching checks, not proof of a person's legal identity.

The owner reviews and approves the request. The signed receipt is bound to the
installation and machine. A reinstall needs a fresh installation ID and approval.

For recovery, sign in to the owner dashboard, enter the original key record ID and
its recovery key, then confirm replacement. The replacement inherits the original
client details, tools and expiry; it does not extend an expired subscription.
The old key is marked replaced and its pending requests are rejected. The recovery
secret cannot be reused. A new licence key and recovery key are shown once.
Print fresh sheets, then approve the new installation when its request arrives.

Already activated offline installations cannot be instantly revoked. The replacement
workflow is not proof that the old computer has been uninstalled. Online leases,
retirement confirmation and rollback-resistant storage are required for stronger
single-install enforcement. Expiry currently uses the client clock while offline;
it is not resistant to an administrator rolling that clock back.

## Release Status

The 0.8.0 EXE remains an all-tools local preview, as previously approved. It does
not enforce these managed licences. Client validation is implemented in the managed
activation flow, not a mandatory licence page in the preview setup wizard.
An enforced customer installer still requires HTTPS authority configuration and
production hardening. Older clients reject the new expiring receipt format instead
of silently treating it as permanent. Existing lifetime receipts remain compatible.

The owner dashboard was tested with ephemeral fictional clients, not real customer
data. No real authority password/key was replaced, no customer activation was
performed, and nothing was published to a public server.

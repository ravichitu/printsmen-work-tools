# Supabase setup

Project URL and the publishable key are stored in `supabase/config.json`. A publishable key is intended for client applications; the service-role key and database password must never go in this app, installer, repository, or browser.

## Create the initial owner

1. In the Supabase dashboard, open SQL Editor and run these files in order: `supabase/migrations/202610150001_printsmen_accounts_licensing.sql`, `supabase/migrations/202610160001_cloud_licence_and_device_sync.sql`, then `supabase/migrations/202610160002_activation_applied_timestamp.sql`.
2. In Authentication settings, use email/password sign-in. Turn off public sign-ups after creating the first account.
3. Create/sign up the owner account, then run this SQL with the actual owner email. The second migration allows this one-time SQL Editor bootstrap only while no active owner exists; later role/access changes require the owner:

```sql
update public.profiles p
set role = 'owner', account_state = 'active', updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = lower('OWNER_EMAIL_HERE');
```

4. Invite each operator in Authentication. New profiles start as `pending`; set `account_state='active'` only after checking the user. Assign the `operator` role to normal users.

## Licence and device sync

The local owner dashboard can connect with an active Supabase `owner` or `admin` account and explicitly sync its register. Supabase receives client contact fields, enabled tools, licence status/expiry, and a SHA-256 hash of each licence key. It never receives plaintext licence/recovery keys or the local signing key. Installation rows are included only when the customer accepted the reporting notice; disconnected/unreported installs remain absent. This inventory is self-reported operational data, not tamper-proof device attestation.

In the managed app, an active operator can separately opt in on the Activation dashboard to report an installation. Reports contain the installation ID, a device hash, app version, platform, activation mode and reporting timestamps; artwork and print files are never collected. New app reports are recorded as `pending`; an application report cannot grant licence approval.

## Current integration boundary

Managed builds use Supabase email/password sign-in and require an active profile. Local preview continues to use its separate preview login. All three migrations must be applied and the owner profile activated before managed sign-in, owner sync or device reporting can work. Licence issuance and signing stay on the owner's computer; only register metadata is synced. Offline file activation remains available in managed builds. Device records require explicit consent and a report; disconnected and unreported copies cannot be counted. Do not store artwork, uploaded print files, passwords, plaintext licence keys or signing keys in the licence register.

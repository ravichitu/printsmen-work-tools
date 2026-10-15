# Supabase setup

Project URL and the publishable key are stored in `supabase/config.json`. A publishable key is intended for client applications; the service-role key and database password must never go in this app, installer, repository, or browser.

## Create the initial owner

1. In the Supabase dashboard, open SQL Editor and run `supabase/migrations/202610150001_printsmen_accounts_licensing.sql`.
2. In Authentication settings, use email/password sign-in. Turn off public sign-ups after creating the first account.
3. Create/sign up the owner account, then run this SQL with the actual owner email:

```sql
update public.profiles p
set role = 'owner', account_state = 'active', updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = lower('OWNER_EMAIL_HERE');
```

4. Invite each operator in Authentication. New profiles start as `pending`; set `account_state='active'` only after checking the user. Assign the `operator` role to normal users.

## Current integration boundary

Managed builds use Supabase email/password sign-in and require an active profile. Local preview continues to use its separate preview login. The migration must be applied and the owner profile activated before a managed build can sign in. The existing local licence owner dashboard is still the authority for issuing and signing licence keys; synchronising that signing authority with Supabase is a later step. Offline file activation remains available in managed builds. Device records require the app to report them; disconnected and unreported copies cannot be counted. Do not store artwork, uploaded print files, or passwords in the licence register.

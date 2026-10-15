# PrintsMen licensing and activation guide

## Three operating modes

- **Local preview (no production licence):** runs the preview installer with its local operator login. It is for testing, is not protected by customer licensing, and does not register usage in Supabase. This is different from offline activation.
- **Online activation:** a managed installation connects to the owner activation authority, which checks the key and installation and waits for owner approval. Internet is required for the approval exchange. After activation, the signed licence can be used offline on that installation.
- **Offline file activation:** a managed installation can exchange request, approval and confirmation JSON files with the owner. The client app does not need internet during this exchange. Supabase sync is optional and can be done later from an internet-connected owner computer.

An offline licence is still a real owner-issued, signed licence. It is not a no-licence mode, and it is not generated or approved by the client computer.

**Current deployment state:** online activation is not available until the owner activation authority is hosted on HTTPS and a managed installer is built for that URL. Supabase is currently the account and reporting database; it is not the key signer or activation authority. Until the hosted authority exists, use managed offline file activation. Supabase sign-in and sync also require applying all three SQL migrations and activating the Supabase owner profile.

## Owner: make and approve a licence

1. Start **PrintsMen Licence Manager** on the owner computer and sign in to its local owner dashboard.
2. Enter the client/shop details, select the allowed tools and optional expiry, then choose **Generate unique key**.
3. Save the client licence sheet and give the key only to that client. The recovery key is owner-only; keep it separately. The owner authority stores hashes, not the displayed secrets.
4. For online activation, approve the incoming request in **Activation requests**.
5. For offline activation, import the client's activation request JSON, approve it, then use **Download approval** to return the approval JSON to that client.

For an offline managed package, run `node build-managed.mjs offline C:\ABSOLUTE\NEW-OUTPUT-FOLDER` from the owner Licence Manager folder. The builder asks for a client-package operator username and a password twice without echoing it. Give those local login credentials privately with the package. The package stores only the salted password hash. Offline packages have one local operator login; multiple individually managed users need the connected Supabase account path.

## Client: activate online

1. Install and start the managed application, then sign in with an active Supabase operator account for online packages or the owner-created local username/password for an offline package.
2. Open **Activation dashboard**, enter the client/shop name and owner-issued key, then choose **Request / check activation online**.
3. Wait for the owner to approve the request, then choose **Request / check activation online** again to accept the signed licence.
4. The status page shows the tools, validity and activation times. The owner dashboard shows request, approval and confirmation times.

The activation page has an optional reporting-consent checkbox. If selected, the owner activation register may receive the installation ID, device hash, app version and platform. It never sends artwork or print files.

## Client: activate offline

1. On **Activation dashboard**, enter the client/shop name and key. For the owner register to include the device record, optionally accept the data notice.
2. Choose **Download activation request** and send `printsmen-activation-request.json` privately to the owner. This request contains the licence key; protect it like a credential.
3. The owner imports the request in the Licence Manager, approves it, and returns the downloaded approval JSON.
4. Import that file using **Import owner approval**. The application validates and saves the signed licence locally.
5. Choose **Download activation confirmation** and return the confirmation JSON to the owner. This lets the owner dashboard record that the client reported successful activation.

Keep the activation request, approval and confirmation files private. They contain installation or licence metadata. Offline requests and confirmations appear in the owner dashboard only after the owner imports their files.

## Supabase sign-in, register sync and device reporting

1. Apply the three SQL migrations in order and activate the first owner account as described in [SUPABASE-SETUP.md](SUPABASE-SETUP.md).
2. In the owner Licence Manager, sign in locally, then connect using an active Supabase `owner` or `admin` account.
3. Choose **Sync keys and consented devices** when ready. This sends client contact fields, selected tools, status/expiry and one-way licence-key hashes. Plaintext licence keys, recovery keys, passwords and the signing key are not uploaded.
4. For offline clients, sync after importing their consented request/confirmation files. Only requests with accepted reporting consent are included.
5. A managed app user can separately opt in on **Activation dashboard** under **Installation reporting**. This sends the installation ID, device hash, app version, platform, activation mode and timestamps. It does not grant a licence.

Supabase sync requires internet. A client used offline can continue to work under its signed licence; its usage cannot be shown in the cloud register until a consented report is imported or sent later.

## Understanding the timestamps

- **Applied on this device** is captured when the local app successfully verifies and saves the signed licence. It uses the device clock and is shown in the device's local timezone; it is useful operational data, not tamper-proof evidence.
- **Licence issued (authority UTC)** is inside the signed licence and comes from the owner authority's clock.
- **Received, approved and owner confirmation** are recorded by the owner authority. Offline confirmation time means when the owner imports the confirmation file; it is separate from the device-reported apply time.
- Older installations activated before this timestamp field was added may show that their local apply time was not recorded. Rechecking activation can record it where the authority still permits the existing approval.

## Security and availability limits

- The owner keeps the Ed25519 signing authority locally. Supabase receives only register data through authenticated requests and RLS; never put a service-role key or database password in the app.
- Device reporting is voluntary and self-reported, not hardware attestation. Offline or unreported installations cannot be counted live, and an already activated offline licence cannot be immediately revoked remotely.
- Reinstallation requires a replacement key and owner approval. A recovery key is one-use and owner-controlled.
- The local preview is not a commercial licensing release. Code patching, administrator access and restored system snapshots can bypass local enforcement. Do not represent this prototype as tamper-proof DRM.

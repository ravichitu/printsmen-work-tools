# PrintsMen Work Tools

PrintsMen Customised Studio is a local-first Windows print-production application.

## Included

- `PrintsMen Badge Studio/` - operator application, Customised Studio, PrintsMen production tools, Product Studio, activation status, Update Manager, and the common application dashboard.
- `PrintsMen Licence Manager/` - owner-only local key maker, activation approval dashboard, recovery-key workflow, licence sheets, and signed-release tools.

The 0.9.3 application dashboard reports the installed version, operator session,
licence state, enabled tools, and update-feed readiness. The 0.9.3 preview build
is intentionally local and does not enforce production licensing.

## Run locally

From `PrintsMen Badge Studio`:

```powershell
node server.mjs
```

Open `http://127.0.0.1:4178/index.html`. The preview installer uses its bundled
runtime and requires the temporary local operator account configured by the owner.

The owner dashboard is separate. Read `PrintsMen Licence Manager/README.md` before
creating keys. Never distribute its `private/` directory or its authority state.

## Production boundary

Online activation requires an owner-controlled HTTPS authority. Automatic updates
require an owner-signed release feed hosted over HTTPS. Neither hosting service is
configured in this repository. Do not expose the local preview server to the public
internet.

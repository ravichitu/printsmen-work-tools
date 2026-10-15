# Offline, no-licence preview backup

This setup is a local preview for your own disconnected computers. It runs the
studio without a production licence check or Supabase sign-in. It is not a client
licence installer, and it must not be described as a licensed release.

## Backup contents

The paired backup folder contains the tested 0.9.6 preview installer, portable
ZIP, checksums, build report, source revision and this setup note. Verify the
files against `SHA256SUMS.txt` before restoring them. Keep a second copy on an
external drive. Do not put owner keys, `private/authority.dpapi`, the owner
dashboard folder, Supabase service-role keys or database passwords in this backup.

## Restore and run

1. Copy the backup folder to the offline Windows computer.
2. Run `PrintsMen-Badge-Studio-0.9.6-Preview-Setup.exe` and choose the local
   preview edition. It does not need Supabase or a licence server.
3. Start PrintsMen Customised Studio from its shortcut and sign in with the
   preview operator account configured for this build.
4. When disconnected, update checks cannot reach GitHub; the installed preview
   continues to run. Keep exported print jobs and project files in a separate
   user backup because this installer backup contains no customer artwork.

The managed branch uses Supabase for operator sign-in and the separate owner
licence authority for generating and signing client keys. Those controls are not
part of this no-licence preview backup.

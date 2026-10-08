# ASSIZE — Privacy Policy

**Effective date:** 2026-10-09 · **App:** ASSIZE (`com.assize.game`) · **Contact:** privacy@assize.game

> Host this file at a public URL (GitHub Pages or any static host) and register that URL
> in both App Store Connect (App Privacy) and Google Play Console (Data safety) before
> submission — both consoles require a reachable privacy policy URL. The in-app summary
> lives on the Settings screen and says the same thing in shorter words: *"No email. No
> trackers. A guest number lives on your device. The court keeps your Standing, your
> daily times, and nothing that names you."*

## The short version

ASSIZE is a 1v1 sudoku duel set in the plague-walled city of Novem. It collects **no
email, no phone number, no advertising identifiers, and no analytics**. There are no
accounts: you play as a guest whose identity is a random number generated on your device.
Nothing about you is sold, rented, or shared with advertisers — there are no advertisers.

## What lives on your device only

- **Your save** — campaign progress, Ink, Standing history, cosmetics, settings — stored
  locally (MMKV / AsyncStorage / the file system, with the echo ring in SQLite).
- **Your guest secret** — the credential for your guest number, stored in the device
  Keychain (iOS) / Keystore (Android) via `expo-secure-store`. It never leaves the device
  except to authenticate a duel-server request.
- **Your sealed echoes** — replay chits you choose to export. They leave the device only
  when you share them yourself.

## What reaches the duel server (only when you play online)

When you queue for a ranked duel or join a friend's challenge code, the server receives
and stores the minimum the duel needs:

| Data | Why | Kept |
|---|---|---|
| A guest identifier and display name | to pair you and remember your Standing | for the life of the season's ladder |
| Your Order choice and duel results | to run the duel and settle the ladder | season ledger only |
| Daily/weekly play timestamps | to enforce the once-a-day rites honestly | rolling window |
| Your **recovery code's hash** | the sole credential that can move your Ink to a new device | until you clear it |

The server never sees your email, contacts, location, photos, or device identifiers
beyond the guest number above. The recovery **code itself** is shown only to you; the
server stores only its SHA-256 hash and cannot recover it.

## Permissions

The app requests **no** dangerous Android permissions and triggers **no** iOS permission
dialogs. Audio plays only (no microphone); haptics, clipboard, and file sharing operate
on content you produce in the game.

## Deletion

Deleting the app erases every local trace. To erase the server-side guest record, use
the Settings screen's ledger purge on the device, then contact **privacy@assize.game**
from the same install if you also want the server row removed.

## Children

ASSIZE is rated 4+ / Everyone. The occult theme ("Shades", "wax seals") is restrained
puzzle dressing: no realistic violence, no gore, no gambling, no chat with strangers.

## Changes

If a future release adds analytics, purchases, or any new data flow, this policy and the
store Data Safety / App Privacy declarations will be updated **in the same release** —
declarations must always match what the shipping binary can do.

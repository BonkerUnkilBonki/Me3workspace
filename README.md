# M3E Workspace

A notes app — pages, tasks, tables, boards, calendar, covers, properties,
comments, version history — that runs as a website and syncs your notes across
your devices. Phone, tablet or desktop; the layout adapts to the screen.

This is a **static site**. No build step, no server, no dependencies. Put the
files on GitHub, switch on Pages, done.

## Publish on GitHub Pages

1. Put every file in this folder in the **root** of your repository (so
   `index.html` sits at the top level, next to this README).
2. In the repository: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*,
   branch **main**, folder **/ (root)**, and **Save**.
4. Wait a minute, then open `https://<your-username>.github.io/<your-repo>/`.

That URL is the app. On a phone you can add it to the home screen and it opens
full screen like an installed app.

## Sync

Open **☰ → Sync → Account**. Two ways in, both sync over the internet — Wi-Fi or
mobile data, different networks, nothing to sign up for:

- **Sign in with a code** — tap *Make me a code* on one device, type the same
  code on the other, tap *Use this code*.
- **Or use an account** — a username and password you choose; sign in with the
  same details on each device.

Use the same code (or the same account) on every device and they share the same
notes. Sync runs on its own: it pulls every few seconds, pushes as soon as you
change something, and merges before it writes, so nothing is overwritten.

**Where your notes are kept.** On a static site there is no server of your own,
so the shared copy lives in free public key-value stores that need no account
(setget.net, then mantledb.sh as a backup). The key is derived on your device
from your code or password, so the store never sees your secret — but treat the
code like a password, because anyone who has it can read that copy. Your notes
also always live on the device itself and the app works fully offline.

### Want your own server instead?

Keep your notes on a machine you control. There is an optional one-file sync
server in [`server/`](server/). Run it anywhere Node runs, then set its address
in `config.js`. The app then uses your server first and only falls back to the
public stores if it cannot be reached. See `server/README.md`.

### The other sync options

The panel also lists **Peer** (works in the browser — syncs directly between
devices over WebRTC) and **Wi-Fi**, **Nearby**, **Code**, which were driven by
the original Android app's own networking and have no browser equivalent, so
they are inert here. **Account** and **code** are the ones that matter.

## Files

```
index.html              the app
config.js               where to find an optional sync server (empty = public stores)
manifest.webmanifest    makes it installable
sw.js                   keeps the shell available offline
icon-192.png, icon-512.png
vendor/sync.bundle.js   Yjs + y-webrtc, for Peer sync
server/                 optional: your own sync server
```

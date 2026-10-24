# M3E Workspace — website

Your Android app, rebuilt as a website. It keeps the whole app — pages, tasks,
tables, boards, calendar, the Notion-style covers/properties/comments/version
history — and it runs in any browser on a phone, a tablet or a desktop. The
layout re-flows to fit the screen instead of being pinned to a phone frame.

The same folder is both the website and the sync server, so one command gives
you a working, syncing app.

## Run it

```bash
node server.js
```

It prints a URL, e.g. `http://localhost:8787`. Open that on each device.

- `PORT` — port to listen on (default `8787`)
- `DATA` — where the sync data is kept (default `./data`)

No dependencies. Node 16 or newer.

## How sync works

Open **☰ → Sync**. Pick **Account**. There are two ways in, and both sync your
notes across the internet — Wi-Fi or mobile data, different networks, nothing to
sign up for:

- **Sign in with a code.** Tap *Make me a code* on one device, then type the
  same code on the other and tap *Use this code*. Both derive the same key, so
  both see the same notes.
- **Or use an account.** A username and password you choose. Sign in with the
  same details on every device.

On both devices use the **same server** — the URL `server.js` printed. That is
what puts them on the same copy of your notes.

Sync runs by itself: it pulls every few seconds and pushes as soon as you change
something, and it merges before it writes, so nothing is ever blindly
overwritten. A device that has been offline catches up as soon as it is back.

### The other sync options

The Sync panel also lists **Wi-Fi**, **Nearby**, **Peer** and **Code**:

- **Peer** works in the browser today. It syncs notes directly between devices
  over WebRTC; the public signalling servers are community-run and can be
  unreliable, and there is a field to point it at your own.
- **Wi-Fi**, **Nearby** and the MQTT **Code** link were driven by the Android
  app's own network code. A browser has no equivalent, so those three are
  inert here. Everything that matters for cross-device sync — **Account** and
  **code** — works.

## Put it on the internet

You need HTTPS in front of it (otherwise passwords cross the network in the
clear). Two ways:

**1. One host does everything (easiest).** Deploy this folder to any Node host —
Render, Railway, Fly, Glitch, a small VPS — and start it with `node server.js`.
Set `PORT` to whatever the host wants. The app and the sync API come from the
same origin, so there is nothing else to configure. Put TLS in front (most of
those hosts do it for you).

**2. Static app, separate sync server.** Host `public/` as plain static files
(Netlify, Vercel, GitHub Pages, S3…), run `server.js` somewhere that stays up,
and edit `public/config.js`:

```js
window.M3E_SERVER = 'https://m3e-sync.example.com';
```

The server sends CORS headers, so this works. With no server reachable at all,
the app still runs and saves everything on the device — only cross-device sync
needs the server.

## What is in here

```
server.js              the website server + sync API (one file, no deps)
package.json
public/
  index.html           the app (single page)
  config.js            where to find the sync server (blank = same origin)
  vendor/sync.bundle.js  Yjs + y-webrtc, for Peer sync
  manifest.webmanifest  makes it installable
  sw.js                 keeps the shell available offline
  icon-192.png
  icon-512.png
data/                  created on first run: accounts, sessions, documents
```

### The sync API (what the app calls)

| Method   | Path                | Purpose                                    |
|----------|---------------------|--------------------------------------------|
| GET      | `/health`           | is it alive                                |
| GET/PUT  | `/kv/<key>?password=` | the shared document for a code or account |
| POST     | `/signup`           | create an email account → token            |
| POST     | `/login`            | sign in → token                            |
| GET/PUT  | `/doc`              | the document for a signed-in account       |

For `/kv/…`, the `<key>` is derived on the device from the code or the
credentials, so the server never sees the secret. Passwords for the optional
email accounts are stored as scrypt hashes with a per-user salt, never in clear.
Files are written atomically.

## What changed from the Android app

The web layer was already written to run without the native shell — it falls
back to `fetch` when there is no `MW` bridge — so the app itself is unchanged in
behaviour. Two real bugs that broke sync, and the responsive work, were fixed:

1. **A synced note did not appear until you touched the screen.** The merge
   routine stamped the *currently open* note and, when no note was open, threw
   before it could re-draw — so the note was saved but the list stayed stale.
   The stamp is now a no-op when nothing is open, so a merge always re-renders.
2. **The code shown on screen did not match the code that was used.** *Make me a
   code* builds a 9-character code, but the panel displayed only the first six,
   so the code you read out derived a *different* key on the other device and
   the two never met. The whole code is now shown.
3. **Adaptive layout.** The gallery goes from two columns on a phone up to six
   on a wide desktop; the note editor caps its width so text does not stretch;
   the Sync panel becomes a centred dialog on larger screens; landscape phones
   and short windows get their height back. Safe-area insets are respected on
   notched devices, and the app is installable (manifest + service worker).

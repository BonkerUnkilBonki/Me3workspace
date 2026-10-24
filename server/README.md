# Optional sync server

You do **not** need this. The site syncs through free public stores on its own.
Run this only if you want your notes kept on a machine you control — no third
party, bigger documents, your own backups.

It is one file with no dependencies, and it serves both the app and the sync
API, so one command gives you everything.

## Run it

From this folder:

```bash
node server.js
```

It prints a URL, e.g. `http://localhost:8787`. Open that and the app loads;
sync goes to this server.

- `PORT` — port to listen on (default `8787`)
- `DATA` — where the data is kept (default `./data`)
- `PUBLIC` — the folder to serve (default `..`, the repo root, where `index.html` lives)

## Point the app at it

If the app is on a different host than this server (e.g. app on GitHub Pages,
server on a VPS), open `config.js` in the repo root and set:

```js
window.M3E_SERVER = 'https://m3e-sync.example.com';
```

The app then uses this server first and only falls back to the public stores if
it cannot be reached. The server sends CORS headers, so cross-origin is fine.

Put HTTPS in front of it on the open internet — otherwise passwords cross the
network in the clear.

## What it stores

- `<key>.json` — one document per code or account
- `users.json`, `sessions.json` — only if you use the optional email accounts
- Passwords are scrypt hashes with a per-user salt, never in clear
- Files are written atomically, so an interrupted write cannot corrupt the last
  good copy

#!/usr/bin/env node
/**
 * M3E Workspace — website + sync server.
 *
 * One file, no dependencies. It does two jobs:
 *
 *   1. Serves the web app in ./public (index.html, vendor, icons, manifest, sw).
 *   2. Provides the sync API the app talks to, on the same origin — so account
 *      sync and code sync work with nothing to configure and no third party.
 *
 * Run it anywhere Node runs:
 *
 *     node server.js
 *
 * Then open the URL it prints. On every device, use the same server, and either
 * the same code or the same username and password — that is what makes the
 * devices show the same notes.
 *
 *   PORT   port to listen on            (default 8787)
 *   DATA   where data is kept           (default ./data)
 *
 * Passwords are stored as scrypt hashes with a per-user salt — never in clear.
 * Files are written atomically, so an interrupted write cannot corrupt the last
 * good copy. Put HTTPS in front of this on the open internet.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8787', 10);
const DATA = process.env.DATA || path.join(__dirname, 'data');
const PUB  = process.env.PUBLIC || path.join(__dirname, '..');   /* the site folder (this repo's root) */
const MAX  = 8 * 1024 * 1024;

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(path.join(DATA, 'kv'), { recursive: true });
const USERS = path.join(DATA, 'users.json');
const SESS  = path.join(DATA, 'sessions.json');

function load(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } }
function save(f, v) {
  const t = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(t, JSON.stringify(v));
  fs.renameSync(t, f);                       /* atomic */
}

let users = load(USERS, {});
let sessions = load(SESS, {});

const keyOf = email => crypto.createHash('sha256').update('m3e:' + email).digest('hex');
const docFile = email => path.join(DATA, keyOf(email) + '.json');
const kvFile = key => path.join(DATA, 'kv', crypto.createHash('sha256').update(String(key)).digest('hex') + '.json');

function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------------- static files ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.normalize(path.join(PUB, rel));
  if (full !== PUB && !full.startsWith(PUB + path.sep)) return send(res, 403, { error: 'forbidden' });
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      /* let the app handle unknown in-app paths */
      const idx = path.join(PUB, 'index.html');
      if (path.extname(rel) === '' && fs.existsSync(idx)) return stream(res, idx, 'text/html; charset=utf-8');
      return send(res, 404, { error: 'not found' });
    }
    stream(res, full, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', st);
  });
}
function stream(res, full, type, st) {
  const headers = { 'Content-Type': type, 'Cache-Control': type.indexOf('html') >= 0 ? 'no-cache' : 'public, max-age=3600' };
  if (st) headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}
function body(req, cb) {
  let b = ''; let over = false;
  req.on('data', c => { b += c; if (b.length > MAX) { over = true; req.destroy(); } });
  req.on('end', () => cb(over ? null : b));
}
const whoami = req => {
  const u = new URL(req.url, 'http://localhost');
  const t = ((req.headers.authorization || '').replace(/^Bearer\s+/i, '') || u.searchParams.get('token') || '').trim();
  return t && sessions[t] ? sessions[t] : null;
};
const q = (u, k) => u.searchParams.get(k) || '';

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }

  /* ---------------- health ---------------- */
  if (p === '/health') return send(res, 200, { ok: true, users: Object.keys(users).length });

  /* ---------------- the shared document store (account + code sync) ----------------
     Keyed by a value derived on the device from the code or the credentials, so
     the server never sees the secret itself. The key is a capability: whoever
     knows it can read the copy, which is exactly the app's model. */
  if (p.indexOf('/kv/') === 0) {
    const key = p.slice(4);
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(key)) return send(res, 400, { error: 'bad key' });
    const pw = q(url, 'password');
    const file = kvFile(key);
    const rec = load(file, null);

    if (req.method === 'GET') {
      if (!rec) return send(res, 200, {});                    /* reachable, nothing stored yet */
      if (rec.pw && pw && !safeEq(rec.pw, pw)) return send(res, 403, { error: 'wrong password' });
      return send(res, 200, rec.doc || {});
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      return body(req, b => {
        if (b == null) return send(res, 413, { error: 'too large' });
        let doc; try { doc = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'not JSON' }); }
        if (!doc || !Array.isArray(doc.pages)) return send(res, 400, { error: 'not a workspace document' });
        if (rec && rec.pw && pw && !safeEq(rec.pw, pw)) return send(res, 403, { error: 'wrong password' });
        try {
          save(file, { pw: rec && rec.pw ? rec.pw : pw, at: Date.now(), doc });
          return send(res, 200, { ok: true, at: Date.now() });
        } catch (e) { return send(res, 500, { error: 'could not save' }); }
      });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* ---------------- email + password accounts (optional) ---------------- */
  if (p === '/signup' && (req.method === 'POST' || req.method === 'PUT')) {
    return body(req, b => {
      let d; try { d = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'bad request' }); }
      const email = String(d.email || '').trim().toLowerCase();
      const pw = String(d.password || '');
      if (!validEmail(email)) return send(res, 400, { error: 'that does not look like an email' });
      if (pw.length < 6) return send(res, 400, { error: 'password must be at least 6 characters' });
      if (users[email]) return send(res, 409, { error: 'an account with that email already exists' });
      const salt = crypto.randomBytes(16).toString('hex');
      users[email] = { salt, hash: hashPw(pw, salt), made: Date.now() };
      save(USERS, users);
      const token = makeToken(); sessions[token] = email; save(SESS, sessions);
      send(res, 200, { ok: true, token, email });
    });
  }
  if (p === '/login' && (req.method === 'POST' || req.method === 'PUT')) {
    return body(req, b => {
      let d; try { d = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'bad request' }); }
      const email = String(d.email || '').trim().toLowerCase();
      const pw = String(d.password || '');
      const u = users[email];
      if (!u || !safeEq(hashPw(pw, u.salt), u.hash)) return send(res, 401, { error: 'email or password is wrong' });
      const token = makeToken(); sessions[token] = email; save(SESS, sessions);
      send(res, 200, { ok: true, token, email });
    });
  }
  if (p === '/doc') {
    const email = whoami(req);
    if (!email) return send(res, 401, { error: 'please sign in' });
    if (req.method === 'GET') {
      try { return send(res, 200, JSON.parse(fs.readFileSync(docFile(email), 'utf8'))); }
      catch (e) { return send(res, 200, {}); }
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      return body(req, b => {
        let d; try { d = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'not JSON' }); }
        try { save(docFile(email), d); send(res, 200, { ok: true }); }
        catch (e) { send(res, 500, { error: 'could not save' }); }
      });
    }
  }

  /* ---------------- everything else: the app itself ---------------- */
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  console.log('');
  console.log('  M3E Workspace — website + sync server');
  console.log('  ------------------------------------------------');
  console.log('  App:   http://localhost:' + PORT);
  console.log('  Data:  ' + DATA);
  console.log('  Users: ' + Object.keys(users).length);
  console.log('');
  console.log('  Open the App URL on each device, then Sync -> Account or Code.');
  console.log('  Same code (or same username and password) on every device = same notes.');
  console.log('');
});

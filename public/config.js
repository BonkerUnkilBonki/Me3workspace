/* M3E Workspace — deployment config.
 *
 * Leave this empty and the app syncs against the server that served it, which
 * is what you want when you run the bundled server.js (it serves this folder
 * AND the sync API from one place).
 *
 * If you host the app as plain static files somewhere else (Netlify, Vercel,
 * GitHub Pages, S3...) and run the sync server on a different host, put that
 * server's full address here, with no trailing slash:
 *
 *   window.M3E_SERVER = 'https://m3e-sync.example.com';
 *
 * The server sends CORS headers, so a cross-origin sync server works.
 */
window.M3E_SERVER = window.M3E_SERVER || '';

/* M3E Workspace — deployment config.
 *
 * You do not need to change anything to publish this on GitHub Pages.
 *
 * Left empty, the app syncs through free public key-value stores that need no
 * account and no server (setget.net, then mantledb.sh). Sign in with a code or
 * an account on each device and they share the same notes. Nothing to run,
 * nothing to pay for, works on a purely static site.
 *
 * If you would rather keep your notes on your own sync server (privacy, no
 * third party, bigger documents), run the server in ./server and put its full
 * address here, with no trailing slash:
 *
 *   window.M3E_SERVER = 'https://m3e-sync.example.com';
 *
 * When this is set the app uses your server first and only falls back to the
 * public stores if it cannot be reached.
 */
window.M3E_SERVER = window.M3E_SERVER || '';

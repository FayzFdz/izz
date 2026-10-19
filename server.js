'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApiRequest } = require('./backend');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 8000);
const HOST = String(process.env.HOST || '127.0.0.1');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon'
};

function send(res, status, value, headers = {}) {
  const body = Buffer.from(value);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', ...headers
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let normalized;
  try { normalized = decodeURIComponent(pathname); }
  catch { return send(res, 400, 'Bad Request'); }
  if (normalized === '/') normalized = '/index.html';
  if (normalized.endsWith('/')) normalized += 'index.html';
  const filePath = path.resolve(ROOT, `.${normalized}`);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  let stat;
  try { stat = fs.statSync(filePath); } catch { return send(res, 404, 'Not Found'); }
  if (!stat.isFile()) return send(res, 404, 'Not Found');
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN'
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname; }
  catch { return send(res, 400, 'Bad Request'); }
  if (pathname.startsWith('/api/')) return handleApiRequest(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  return serveStatic(req, res, pathname);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`A Little World berjalan di http://${HOST}:${PORT}`);
    console.log(`Admin login configured: ${Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) || process.env.NODE_ENV !== 'production'}`);
    console.log(`Persistent database configured: ${Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)}`);
    if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET)) console.warn('Atur ADMIN_EMAIL, ADMIN_PASSWORD, dan SESSION_SECRET di environment.');
  });
}

module.exports = server;

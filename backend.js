'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const CONTENT_FILE = path.join(ROOT, 'content.json');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || (IS_PRODUCTION ? '' : 'admin@littleworld.local')).trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'FaizWorld#2026'));
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (IS_PRODUCTION ? 'true' : 'false')) === 'true';
const SESSION_SECRET = String(process.env.SESSION_SECRET || (IS_PRODUCTION ? '' : 'local-development-only-change-me')).trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const BODY_LIMIT = 28 * 1024 * 1024;
const attempts = new Map();
const passwordSalt = crypto.randomBytes(16);
const expectedPasswordHash = crypto.scryptSync(ADMIN_PASSWORD, passwordSalt, 64);

function send(res, status, value, headers = {}) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': Buffer.isBuffer(value) ? 'application/octet-stream' : (typeof value === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'),
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...headers
  });
  res.end(body);
}

function json(res, status, payload, headers = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers
  });
  res.end(body);
}

function parseCookies(req) {
  const source = String(req.headers.cookie || '');
  return Object.fromEntries(source.split(';').map((part) => {
    const i = part.indexOf('=');
    if (i < 0) return ['', ''];
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([key]) => key));
}

function getSession(req) {
  const token = parseCookies(req).lw_session;
  if (!token || !SESSION_SECRET || !ADMIN_EMAIL) return null;
  const pieces = token.split('.');
  if (pieces.length !== 2) return null;
  try {
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(pieces[0]).digest();
    const supplied = Buffer.from(pieces[1], 'base64url');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    const claims = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'));
    if (claims.role !== 'admin' || claims.email !== ADMIN_EMAIL || !Number.isFinite(claims.expiresAt) || claims.expiresAt <= Date.now()) return null;
    return { role: 'admin', email: claims.email, expiresAt: claims.expiresAt };
  } catch {
    return null;
  }
}

function makeSessionToken(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function sessionCookie(token, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  return `lw_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${COOKIE_SECURE ? '; Secure' : ''}`;
}

function clearCookie() {
  return `lw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`;
}

function requestIp(req) {
  // Ignore X-Forwarded-For unless the hosting environment is explicitly trusted.
  return req.socket.remoteAddress || 'unknown';
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt < now) {
    attempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  return current.count >= 8;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  let current = attempts.get(ip);
  if (!current || current.resetAt < now) current = { count: 0, resetAt: now + 15 * 60 * 1000 };
  current.count += 1;
  attempts.set(ip, current);
}

function readJsonBody(req) {
  // Vercel's Node.js function runtime may parse JSON into req.body before
  // invoking the handler. Local Node HTTP requests still use the raw stream.
  if (req.body !== undefined) {
    try {
      if (Buffer.isBuffer(req.body)) return Promise.resolve(JSON.parse(req.body.toString('utf8') || '{}'));
      if (typeof req.body === 'string') return Promise.resolve(JSON.parse(req.body || '{}'));
      if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
      return Promise.resolve({});
    } catch {
      return Promise.reject(Object.assign(new Error('Format JSON tidak valid.'), { statusCode: 400 }));
    }
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error('Request terlalu besar.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Format JSON tidak valid.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser CLI calls are still gated by the session cookie
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || !content.profile || !Array.isArray(content.tracks) || !Array.isArray(content.photos)) return false;
  if (content.education !== undefined && !Array.isArray(content.education)) return false;
  if (content.tracks.length > 100 || content.photos.length > 200 || (content.education || []).length > 100) return false;
  return true;
}

async function supabaseRequest(url, options = {}) {
  // Supabase secret API keys (sb_secret_...) are passed as apikey only;
  // legacy service_role JWT keys also work as a Bearer token.
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    ...(SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }),
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 400)}`);
  }
  return response;
}

async function readStoredContent() {
  if (!SUPABASE_ENABLED) return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const endpoint = `${SUPABASE_URL}/rest/v1/site_content?id=eq.1&select=content`;
  const response = await supabaseRequest(endpoint, { method: 'GET' });
  const rows = await response.json();
  if (Array.isArray(rows) && rows[0] && rows[0].content) return rows[0].content;

  // Seed the single content row on first use from the bundled website data.
  const initial = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  await writeStoredContent(initial);
  return initial;
}

async function writeStoredContent(content) {
  if (!SUPABASE_ENABLED) {
    const tempPath = `${CONTENT_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, CONTENT_FILE);
    return;
  }
  const endpoint = `${SUPABASE_URL}/rest/v1/site_content?on_conflict=id`;
  await supabaseRequest(endpoint, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, content, updated_at: new Date().toISOString() })
  });
}

async function routeApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/session') {
    const session = getSession(req);
    return json(res, 200, { authenticated: !!session, role: session ? session.role : null });
  }

  if (req.method === 'GET' && pathname === '/api/content') {
    try {
      const content = await readStoredContent();
      return json(res, 200, content);
    } catch (error) {
      console.error('Failed to read persistent content:', error);
      // Keep the portfolio view available if the optional database is temporarily unreachable.
      try { return json(res, 200, JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'))); }
      catch { return json(res, 500, { ok: false, message: 'Konten website tidak dapat dibaca.' }); }
    }
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) return json(res, 503, { ok: false, message: 'Login admin belum dikonfigurasi. Atur ADMIN_EMAIL, ADMIN_PASSWORD, dan SESSION_SECRET pada pengaturan hosting.' });
    const ip = requestIp(req);
    if (tooManyAttempts(ip)) return json(res, 429, { ok: false, message: 'Terlalu banyak percobaan. Coba lagi sekitar 15 menit.' });
    let body;
    try { body = await readJsonBody(req); }
    catch (error) { return json(res, error.statusCode || 400, { ok: false, message: error.message }); }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (email.length > 254 || password.length > 256) return json(res, 400, { ok: false, message: 'Email atau password terlalu panjang.' });
    const attemptHash = crypto.scryptSync(password, passwordSalt, 64);
    const passwordOkay = attemptHash.length === expectedPasswordHash.length && crypto.timingSafeEqual(attemptHash, expectedPasswordHash);
    if (email !== ADMIN_EMAIL || !passwordOkay) {
      recordFailedAttempt(ip);
      return json(res, 401, { ok: false, message: 'Email atau password admin tidak cocok.' });
    }
    attempts.delete(ip);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = makeSessionToken({ role: 'admin', email, expiresAt });
    return json(res, 200, { ok: true, role: 'admin', expiresIn: SESSION_TTL_MS }, { 'Set-Cookie': sessionCookie(token) });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  if (req.method === 'PUT' && pathname === '/api/content') {
    const session = getSession(req);
    if (!session || session.role !== 'admin') return json(res, 401, { ok: false, message: 'Login admin diperlukan.' });
    if (!sameOrigin(req)) return json(res, 403, { ok: false, message: 'Permintaan lintas situs ditolak.' });
    let content;
    try { content = await readJsonBody(req); }
    catch (error) { return json(res, error.statusCode || 400, { ok: false, message: error.message }); }
    if (!validateContent(content)) return json(res, 400, { ok: false, message: 'Struktur konfigurasi tidak sesuai.' });
    try {
      await writeStoredContent(content);
      return json(res, 200, { ok: true, message: 'Konten tersimpan.' });
    } catch (error) {
      console.error('Failed to persist website content:', error);
      return json(res, 500, { ok: false, message: 'Konten tidak dapat disimpan. Periksa konfigurasi database hosting.' });
    }
  }

  return json(res, 404, { ok: false, message: 'API tidak ditemukan.' });
}

async function handleApiRequest(req, res) {
  let pathname;
  try {
    const host = req.headers.host || 'localhost';
    pathname = new URL(req.url || '/', `https://${host}`).pathname;
  } catch {
    return json(res, 400, { ok: false, message: 'URL tidak valid.' });
  }
  if (!pathname.startsWith('/api/')) return json(res, 404, { ok: false, message: 'API tidak ditemukan.' });
  try {
    return await routeApi(req, res, pathname);
  } catch (error) {
    console.error('API error:', error);
    if (!res.headersSent) return json(res, 500, { ok: false, message: 'Terjadi kesalahan server.' });
    return res.destroy();
  }
}

module.exports = { handleApiRequest };

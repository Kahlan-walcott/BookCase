// Hobbyshelf server: serves the pages in ../frontEnd and a JSON API under /api.
// Run with: node server/server.js   (then open http://localhost:3000)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { users, books } = require('../db/database.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontEnd');
const ROOT_DIR = path.join(__dirname, '..');
const MAX_BODY = 10 * 1024 * 1024; // room for photo covers sent as data URLs

const MIME = { 
  '.html': 'text/html; charset=utf-8', 
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', 
  '.jpg': 'image/jpeg', 
  '.svg': 'image/svg+xml' };

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// Placeholder auth: the client sends the user's id in X-User-Id.
// Replace with real sessions or tokens before going live.
function currentUser(req) {
  const id = Number(req.headers['x-user-id']);
  return Number.isInteger(id) && id > 0 ? users.find(id) : null;
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  // POST /api/login  { email, name }  -> creates the account if needed
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) return send(res, 400, { error: 'A valid email is required' });
    const name = String(body.name || '').trim() || email.split('@')[0];
    return send(res, 200, users.upsert(email, name));
  }

  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'Log in first' });

  // GET /api/books  and  POST /api/books
  if (url.pathname === '/api/books') {
    if (req.method === 'GET') return send(res, 200, books.listForUser(user.id));
    if (req.method === 'POST') {
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      if (!title) return send(res, 400, { error: 'Title is required' });
      const book = books.add(user.id, {
        title,
        author: String(body.author || '').trim(),
        isbn: String(body.isbn || '').trim(),
        cover: typeof body.cover === 'string' ? body.cover : null
      });
      return send(res, 201, book);
    }
  }

  // PATCH /api/books/:id  { cover }   and   DELETE /api/books/:id
  if (parts.length === 3 && parts[1] === 'books') {
    const id = Number(parts[2]);
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const ok = books.setCover(user.id, id, typeof body.cover === 'string' ? body.cover : null);
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Book not found' });
    }
    if (req.method === 'DELETE') {
      return books.remove(user.id, id)
        ? send(res, 200, { ok: true })
        : send(res, 404, { error: 'Book not found' });
    }
  }

  send(res, 404, { error: 'Not found' });
}

// Maps a URL path to a file on disk.
// Pages come from frontEnd/, stylesheets from css/ at the project root.
function resolveStaticFile(pathname) {
  if (pathname === '/') return path.join(PUBLIC_DIR, 'landingPage.html');
  const name = path.basename(pathname);
  if (pathname.startsWith('/css/')) return path.join(ROOT_DIR, 'css', name);
  return path.join(PUBLIC_DIR, name);
}

function serveStatic(req, res, url) {
  const file = resolveStaticFile(url.pathname);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, () => console.log(`Hobbyshelf running at http://localhost:${PORT}`));
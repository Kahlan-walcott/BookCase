// Database layer: SQLite file at server/data/hobbyshelf.db (created on first run).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'hobbyshelf.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS books (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    author     TEXT NOT NULL DEFAULT '',
    isbn       TEXT NOT NULL DEFAULT '',
    cover      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS books_by_user ON books(user_id);
`);

const users = {
  // Creates the user if the email is new; otherwise returns the existing one.
  upsert(email, name) {
    db.prepare('INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)').run(email, name);
    return db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);
  },
  find(id) {
    return db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id);
  }
};

const books = {
  listForUser(userId) {
    return db.prepare(
      'SELECT id, title, author, isbn, cover FROM books WHERE user_id = ? ORDER BY created_at, id'
    ).all(userId);
  },
  add(userId, { title, author = '', isbn = '', cover = null }) {
    const result = db.prepare(
      'INSERT INTO books (user_id, title, author, isbn, cover) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, title, author, isbn, cover);
    return db.prepare(
      'SELECT id, title, author, isbn, cover FROM books WHERE id = ?'
    ).get(result.lastInsertRowid);
  },
  setCover(userId, id, cover) {
    return db.prepare('UPDATE books SET cover = ? WHERE id = ? AND user_id = ?')
      .run(cover, id, userId).changes > 0;
  },
  remove(userId, id) {
    return db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?')
      .run(id, userId).changes > 0;
  }
};

module.exports = { db, users, books };
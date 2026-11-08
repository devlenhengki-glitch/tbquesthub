-- Run once in Cloudflare D1 Console for tbquesthub-db.
CREATE TABLE IF NOT EXISTS competitions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 deadline TEXT NOT NULL,
 flyerUrl TEXT NOT NULL,
 createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS academic_editor_sessions (
 tokenHash TEXT PRIMARY KEY,
 expiresAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS competition_flyers (
 id TEXT PRIMARY KEY,
 dataUrl TEXT NOT NULL
);

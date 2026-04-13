const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'voters.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role     TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  )
`);

module.exports = db;

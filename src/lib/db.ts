import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "backend", "voters.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role     TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  )
`);

export default db;

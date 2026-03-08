import Database from "better-sqlite3";
import { join } from "path";

const db = new Database(join(process.cwd(), "contacts.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS Contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber TEXT,
    email TEXT,
    linkedId INTEGER,
    linkPrecedence TEXT NOT NULL CHECK(linkPrecedence IN ('primary', 'secondary')),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  )
`);

export default db;

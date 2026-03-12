import Database from "better-sqlite3";
const db = new Database("oficina.db");
const users = db.prepare("SELECT * FROM usuarios").all();
console.log(JSON.stringify(users, null, 2));

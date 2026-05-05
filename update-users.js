const db    = require("better-sqlite3")("./data/lead-hub.sqlite");
const bcrypt = require("bcryptjs");

async function update() {
  const hash  = await bcrypt.hash("Abmix@2026", 12);
  const users = db.prepare("SELECT id, email FROM users").all();

  for (const u of users) {
    const newEmail = u.email.replace("@abmix.local", "@abmix.com");
    db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?")
      .run(newEmail, hash, u.id);
    console.log("Atualizado:", newEmail);
  }

  console.log("\n--- Usuarios atualizados ---");
  const rows = db.prepare(
    "SELECT id, name, email, role FROM users ORDER BY role DESC, name ASC"
  ).all();
  console.table(rows);
  db.close();
}

update().catch((e) => { console.error(e); process.exit(1); });

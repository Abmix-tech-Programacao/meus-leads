const db     = require("better-sqlite3")("./data/lead-hub.sqlite");
const bcrypt = require("bcryptjs");

async function addMasters() {
  const masters = [
    { name: "Michelle", email: "michelle@abmix.com.br", password: "Fe120784!" },
    { name: "Felipe",   email: "felipe@abmix.com.br",   password: "Fe120784!" },
  ];

  for (const u of masters) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
    if (existing) {
      console.log("Ja existe, pulando:", u.email);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'master', 1)"
    ).run(u.name, u.email, hash);
    console.log("Cadastrado:", u.email);
  }

  console.log("\n--- Masters no sistema ---");
  console.table(
    db.prepare("SELECT id, name, email, role FROM users WHERE role = 'master' ORDER BY id").all()
  );
  db.close();
}

addMasters().catch((e) => { console.error(e); process.exit(1); });

const fs = require("fs");
const { db, initDb, findUserByEmail, createUser, normalizeSellerName } = require("./db");
const { hashPassword } = require("./auth");
const { seedPath } = require("./config");

async function bootstrap() {
  initDb();
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  const masters = Array.isArray(seed.masters)
    ? seed.masters
    : (seed.master ? [seed.master] : []);

  for (const master of masters) {
    if (!findUserByEmail(master.email)) {
      await createUser({
        name: master.name,
        email: master.email,
        passwordHash: await hashPassword(master.password),
        role: "master",
      });
    }
  }

  for (const vendor of seed.vendors || []) {
    const existingByEmail = findUserByEmail(vendor.email);
    if (existingByEmail) {
      continue;
    }

    const sellerSlug = normalizeSellerName(vendor.name);
    const existingBySlug = db.prepare(`
      SELECT id
      FROM users
      WHERE role = 'vendor' AND seller_slug = ? AND active = 1
      ORDER BY id DESC
      LIMIT 1
    `).get(sellerSlug);

    if (existingBySlug) {
      const passwordHash = await hashPassword(vendor.password);
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, password_hash = ?, seller_name = ?, seller_slug = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(vendor.name, vendor.email, passwordHash, vendor.name, sellerSlug, existingBySlug.id);
    } else {
      await createUser({
        name: vendor.name,
        email: vendor.email,
        passwordHash: await hashPassword(vendor.password),
        role: "vendor",
        sellerName: vendor.name,
      });
    }
  }

  console.log("Bootstrap concluído.");
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

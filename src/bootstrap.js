const fs = require("fs");
const { initDb, findUserByEmail, createUser } = require("./db");
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
    if (!findUserByEmail(vendor.email)) {
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

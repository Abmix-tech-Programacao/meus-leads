const path = require("path");

function requireEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

module.exports = {
  port: Number(requireEnv("PORT", 4100)),
  sessionSecret: requireEnv("SESSION_SECRET", "change-me-session-secret"),
  ingestToken: requireEnv("LEAD_INGEST_TOKEN", "change-me-ingest-token"),
  dbPath: path.join(__dirname, "..", "data", "lead-hub.sqlite"),
  seedPath: path.join(__dirname, "..", "seed-config.json"),
};

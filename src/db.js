const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { dbPath } = require("./config");

const STATUSES = ["novo", "em_tratativa", "aguardando_cliente", "convertido", "perdido"];

function normalizeSellerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function openDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return new Database(dbPath);
}

const db = openDb();

function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('master','vendor')),
      seller_name TEXT,
      seller_slug TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'formulario',
      operadora TEXT NOT NULL DEFAULT 'nao_informada',
      external_id TEXT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT,
      cidade TEXT,
      data_nascimento TEXT,
      numero_vidas INTEGER,
      cnpj TEXT NOT NULL DEFAULT 'nao',
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      assigned_user_id INTEGER,
      assigned_seller_name TEXT,
      assigned_seller_slug TEXT,
      source_payload TEXT,
      last_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lead_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  ensureColumn("leads", "operadora", "TEXT NOT NULL DEFAULT 'nao_informada'");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_seller_slug ON users(seller_slug);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_operadora ON leads(operadora);
    CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id ON leads(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_assigned_seller_slug ON leads(assigned_seller_slug);
  `);
}

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email);
}

function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ? AND active = 1").get(id);
}

function findVendorBySellerName(name) {
  return db.prepare(`
    SELECT *
    FROM users
    WHERE role = 'vendor' AND seller_slug = ? AND active = 1
    ORDER BY id DESC
    LIMIT 1
  `).get(normalizeSellerName(name));
}

function createUser({ name, email, passwordHash, role, sellerName = null }) {
  const sellerSlug = sellerName ? normalizeSellerName(sellerName) : null;
  return db.prepare(`
    INSERT INTO users (name, email, password_hash, role, seller_name, seller_slug)
    VALUES (@name, @email, @passwordHash, @role, @sellerName, @sellerSlug)
  `).run({ name, email, passwordHash, role, sellerName, sellerSlug });
}

function listUsers() {
  return db.prepare(`
    SELECT id, name, email, role, seller_name AS sellerName, active, created_at AS createdAt
    FROM users
    ORDER BY role DESC, name ASC
  `).all();
}

function createLead(payload) {
  const vendor = payload.assignedSellerName ? findVendorBySellerName(payload.assignedSellerName) : null;

  const data = {
    source: payload.source || "formulario",
    operadora: payload.operadora || "nao_informada",
    externalId: payload.externalId || null,
    nome: payload.nome,
    telefone: payload.telefone,
    email: payload.email || null,
    cidade: payload.cidade || null,
    dataNascimento: payload.dataNascimento || null,
    numeroVidas: payload.numeroVidas ? Number(payload.numeroVidas) : null,
    cnpj: payload.cnpj === "sim" ? "sim" : "nao",
    observacoes: payload.observacoes || null,
    status: "novo",
    assignedUserId: vendor ? vendor.id : null,
    assignedSellerName: payload.assignedSellerName || null,
    assignedSellerSlug: payload.assignedSellerName ? normalizeSellerName(payload.assignedSellerName) : null,
    sourcePayload: JSON.stringify(payload),
    lastNote: payload.lastNote || null,
  };

  const result = db.prepare(`
    INSERT INTO leads (
      source, operadora, external_id, nome, telefone, email, cidade, data_nascimento, numero_vidas,
      cnpj, observacoes, status, assigned_user_id, assigned_seller_name, assigned_seller_slug,
      source_payload, last_note
    ) VALUES (
      @source, @operadora, @externalId, @nome, @telefone, @email, @cidade, @dataNascimento, @numeroVidas,
      @cnpj, @observacoes, @status, @assignedUserId, @assignedSellerName, @assignedSellerSlug,
      @sourcePayload, @lastNote
    )
  `).run(data);

  return getLeadById(result.lastInsertRowid);
}

function getLeadById(id) {
  return db.prepare(`
    SELECT
      l.id,
      l.source,
      l.operadora,
      l.external_id AS externalId,
      l.nome,
      l.telefone,
      l.email,
      l.cidade,
      l.data_nascimento AS dataNascimento,
      l.numero_vidas AS numeroVidas,
      l.cnpj,
      l.observacoes,
      l.status,
      l.assigned_user_id AS assignedUserId,
      l.assigned_seller_name AS assignedSellerName,
      l.last_note AS lastNote,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      u.name AS assignedUserName,
      u.email AS assignedUserEmail
    FROM leads l
    LEFT JOIN users u ON u.id = l.assigned_user_id
    WHERE l.id = ?
  `).get(id);
}

function listLeads({ user, status = "", search = "", operadora = "" }) {
  const clauses = [];
  const params = {};

  if (user.role === "vendor") {
    clauses.push("l.assigned_user_id = @userId");
    params.userId = user.id;
  }

  if (status) {
    clauses.push("l.status = @status");
    params.status = status;
  }

  if (operadora) {
    clauses.push("l.operadora = @operadora");
    params.operadora = operadora;
  }

  if (search) {
    clauses.push("(l.nome LIKE @search OR l.telefone LIKE @search OR COALESCE(l.email, '') LIKE @search OR COALESCE(l.assigned_seller_name, '') LIKE @search)");
    params.search = `%${search}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return db.prepare(`
    SELECT
      l.id,
      l.operadora,
      l.nome,
      l.telefone,
      l.email,
      l.cidade,
      l.data_nascimento AS dataNascimento,
      l.numero_vidas AS numeroVidas,
      l.cnpj,
      l.observacoes,
      l.status,
      l.assigned_seller_name AS assignedSellerName,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      l.last_note AS lastNote,
      u.name AS assignedUserName
    FROM leads l
    LEFT JOIN users u ON u.id = l.assigned_user_id
    ${where}
    ORDER BY datetime(l.created_at) DESC, l.id DESC
  `).all(params);
}

function updateLead({ leadId, user, status, note }) {
  if (!STATUSES.includes(status)) {
    throw new Error("Status inválido.");
  }

  const lead = getLeadById(leadId);
  if (!lead) {
    throw new Error("Lead não encontrado.");
  }

  if (user.role !== "vendor") {
    throw new Error("Somente vendedores podem atualizar tratativas.");
  }

  if (lead.assignedUserId !== user.id) {
    throw new Error("Você não tem permissão para editar este lead.");
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE leads
      SET status = @status, last_note = @note, updated_at = CURRENT_TIMESTAMP
      WHERE id = @leadId
    `).run({ status, note: note || null, leadId });

    db.prepare(`
      INSERT INTO lead_updates (lead_id, user_id, old_status, new_status, note)
      VALUES (@leadId, @userId, @oldStatus, @newStatus, @note)
    `).run({
      leadId,
      userId: user.id,
      oldStatus: lead.status,
      newStatus: status,
      note: note || null,
    });
  });

  tx();
  return getLeadById(leadId);
}

function listLeadUpdates(leadId) {
  return db.prepare(`
    SELECT
      lu.id,
      lu.old_status AS oldStatus,
      lu.new_status AS newStatus,
      lu.note,
      lu.created_at AS createdAt,
      u.name AS userName
    FROM lead_updates lu
    INNER JOIN users u ON u.id = lu.user_id
    WHERE lu.lead_id = ?
    ORDER BY datetime(lu.created_at) DESC, lu.id DESC
  `).all(leadId);
}

module.exports = {
  STATUSES,
  db,
  initDb,
  normalizeSellerName,
  findUserByEmail,
  findUserById,
  findVendorBySellerName,
  createUser,
  listUsers,
  createLead,
  getLeadById,
  listLeads,
  updateLead,
  listLeadUpdates,
};

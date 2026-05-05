const path = require("path");
const express = require("express");
const session = require("express-session");
const ExcelJS = require("exceljs");
const { port, sessionSecret, ingestToken } = require("./config");
const { verifyPassword } = require("./auth");
const {
  STATUSES,
  initDb,
  findUserByEmail,
  findUserById,
  listUsers,
  createLead,
  listLeads,
  updateLead,
  listLeadUpdates,
} = require("./db");

initDb();

const app = express();
app.use(express.json());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12,
  },
}));

app.use((req, res, next) => {
  if (req.session.userId) {
    req.user = findUserById(req.session.userId) || null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  next();
}

function requireMaster(req, res, next) {
  if (!req.user || req.user.role !== "master") {
    return res.status(403).json({ error: "Acesso restrito ao usuário master." });
  }
  next();
}

function normalizeLeadPayload(body = {}) {
  return {
    source: body.source || "formulario",
    operadora: String(body.operadora || "nao_informada").trim().toLowerCase(),
    externalId: body.externalId || null,
    nome: String(body.nome || "").trim(),
    telefone: String(body.telefone || "").replace(/\D/g, ""),
    email: String(body.email || "").trim(),
    cidade: String(body.cidade || "").trim(),
    dataNascimento: String(body.dataNascimento || "").trim(),
    numeroVidas: String(body.numeroVidas || "").trim(),
    cnpj: body.cnpj === "sim" ? "sim" : "nao",
    observacoes: String(body.observacoes || body.infoTexto || "").trim(),
    assignedSellerName: String(body.assignedSellerName || body.vendedor || "").trim(),
    lastNote: String(body.lastNote || "").trim(),
  };
}

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }

  req.session.userId = user.id;
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sellerName: user.seller_name,
    },
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const operators = ["bradesco", "amil", "sulamerica", "porto", "nao_informada"];
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      sellerName: req.user.seller_name,
    },
    statuses: STATUSES,
    operators,
  });
});

app.post("/api/public/leads", (req, res) => {
  const token = req.get("x-ingest-token");
  if (!token || token !== ingestToken) {
    return res.status(401).json({ error: "Token de ingestão inválido." });
  }

  const payload = normalizeLeadPayload(req.body);
  if (!payload.nome || !payload.telefone) {
    return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
  }

  const lead = createLead(payload);
  return res.status(201).json({ lead });
});

app.get("/api/leads", requireAuth, (req, res) => {
  const leads = listLeads({
    user: req.user,
    status: String(req.query.status || "").trim(),
    search: String(req.query.search || "").trim(),
    operadora: String(req.query.operadora || "").trim().toLowerCase(),
  });
  res.json({ leads });
});

app.get("/api/leads/:id/updates", requireAuth, (req, res) => {
  const updates = listLeadUpdates(Number(req.params.id));
  res.json({ updates });
});

app.patch("/api/leads/:id", requireAuth, (req, res) => {
  try {
    const lead = updateLead({
      leadId: Number(req.params.id),
      user: req.user,
      status: String(req.body.status || ""),
      note: String(req.body.note || "").trim(),
    });
    res.json({ lead });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/users", requireAuth, requireMaster, (req, res) => {
  res.json({ users: listUsers() });
});

app.get("/api/export/leads.xlsx", requireAuth, requireMaster, async (req, res) => {
  const leads = listLeads({ user: req.user, status: "", search: "", operadora: "" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");

  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nome", key: "nome", width: 28 },
    { header: "Operadora", key: "operadora", width: 16 },
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Cidade", key: "cidade", width: 20 },
    { header: "Data Nascimento", key: "dataNascimento", width: 18 },
    { header: "Numero de Vidas", key: "numeroVidas", width: 16 },
    { header: "CNPJ/MEI", key: "cnpj", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Encaminhado Para", key: "assignedSellerName", width: 24 },
    { header: "Ultima Observacao", key: "lastNote", width: 36 },
    { header: "Criado Em", key: "createdAt", width: 24 },
    { header: "Atualizado Em", key: "updatedAt", width: 24 },
  ];

  for (const lead of leads) {
    sheet.addRow(lead);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="leads.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/brand/logo.jpg", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "logo.jpg"));
});

app.get("/brand/logo.png", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "logo-transparente.png"));
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.listen(port, () => {
  console.log(`Lead Hub ouvindo na porta ${port}`);
});

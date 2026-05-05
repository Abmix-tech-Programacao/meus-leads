const statusFilter    = document.getElementById("statusFilter");
const operatorFilter  = document.getElementById("operatorFilter");
const searchFilter    = document.getElementById("searchFilter");
const refreshBtn      = document.getElementById("refreshBtn");
const exportBtn       = document.getElementById("exportBtn");
const logoutBtn       = document.getElementById("logoutBtn");
const leadGrid        = document.getElementById("leadGrid");
const userMeta        = document.getElementById("userMeta");
const summaryGrid     = document.getElementById("summaryGrid");
const summaryTemplate = document.getElementById("summaryCardTemplate");
const vendorTemplate  = document.getElementById("vendorLeadTemplate");
const masterTemplate  = document.getElementById("masterLeadTemplate");
const resultCount     = document.getElementById("resultCount");
const todayStamp      = document.getElementById("todayStamp");

let auth = null;

/* ─── Labels ─────────────────────────── */
function statusLabel(value) {
  const map = {
    novo:               "Novo",
    em_tratativa:       "Em tratativa",
    aguardando_cliente: "Aguardando cliente",
    convertido:         "Convertido",
    perdido:            "Perdido",
  };
  return map[value] || value;
}

function operatorLabel(value) {
  if (value === "nao_informada") return "Não informada";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Summary cards ──────────────────── */
const CARD_DEFS = [
  { label: "Total de leads",  key: null },
  { label: "Novos",           key: "novo" },
  { label: "Em andamento",    key: "__andamento__" },
  { label: "Convertidos",     key: "convertido" },
];

function renderSummary(leads) {
  const count = { novo: 0, em_tratativa: 0, aguardando_cliente: 0, convertido: 0, perdido: 0 };
  for (const l of leads) {
    if (count[l.status] !== undefined) count[l.status]++;
  }

  summaryGrid.innerHTML = "";
  for (const def of CARD_DEFS) {
    const frag  = summaryTemplate.content.cloneNode(true);
    const value = def.key === null
      ? leads.length
      : def.key === "__andamento__"
        ? count.em_tratativa + count.aguardando_cliente
        : count[def.key] || 0;

    frag.querySelector(".summary-label").textContent = def.label;
    frag.querySelector(".summary-value").textContent = value;
    summaryGrid.appendChild(frag);
  }
}

/* ─── Auth & bootstrap ───────────────── */
async function loadAuth() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) { window.location.href = "/"; return; }

  auth = await response.json();

  userMeta.textContent = auth.user.role === "master"
    ? `${auth.user.name} · Visão master`
    : `${auth.user.name} · Carteira do vendedor`;

  exportBtn.style.display = auth.user.role === "master" ? "inline-flex" : "none";
  todayStamp.textContent  = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  statusFilter.innerHTML   = `<option value="">Todos os status</option>${auth.statuses.map((s) => `<option value="${s}">${statusLabel(s)}</option>`).join("")}`;
  operatorFilter.innerHTML = `<option value="">Todas as operadoras</option>${auth.operators.map((o) => `<option value="${o}">${operatorLabel(o)}</option>`).join("")}`;
}

/* ─── Fill common fields ─────────────── */
function fillCommonFields(scope, lead) {
  const set = (field, value) =>
    scope.querySelectorAll(`[data-field="${field}"]`).forEach((n) => { n.textContent = value; });

  set("nome",               lead.nome);
  set("assignedSellerName", lead.assignedSellerName || "Sem vendedor vinculado");
  set("status",             statusLabel(lead.status));
  set("operadora",          operatorLabel(lead.operadora || "nao_informada"));
  set("telefone",           lead.telefone   || "—");
  set("email",              lead.email      || "—");
  set("cidade",             lead.cidade     || "—");
  set("dataNascimento",     lead.dataNascimento || "—");
  set("numeroVidas",        lead.numeroVidas    || "—");
  set("cnpj",               lead.cnpj === "sim" ? "Sim" : "Não");
  set("observacoes",        lead.observacoes    || "Sem observações informadas no formulário.");
  set("updatedAt",          formatDate(lead.updatedAt));
  set("createdAt",          `Entrada em ${formatDate(lead.createdAt)}`);

  /* Apply data-status so CSS can color the pill dynamically */
  scope.querySelectorAll(".status-pill").forEach((el) => {
    el.dataset.status = lead.status;
  });
}

/* ─── Master row ─────────────────────── */
function renderMasterLead(lead) {
  const fragment = masterTemplate.content.cloneNode(true);
  const row      = fragment.querySelector(".master-row");
  const detail   = row.querySelector(".master-row-detail");
  const toggle   = row.querySelector(".toggle-details");

  fillCommonFields(row, lead);
  row.querySelector('[data-field="lastNote"]').textContent =
    lead.lastNote || "Sem observação interna registrada até o momento.";

  toggle.addEventListener("click", () => {
    const collapsed = detail.classList.toggle("is-collapsed");
    toggle.innerHTML = collapsed
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-1px;margin-right:5px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Visualizar`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-1px;margin-right:5px"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Ocultar`;
  });

  return fragment;
}

/* ─── Vendor card ────────────────────── */
function renderVendorLead(lead) {
  const fragment = vendorTemplate.content.cloneNode(true);
  const card     = fragment.querySelector(".lead-card");

  fillCommonFields(card, lead);

  const form   = card.querySelector(".update-form");
  const select = form.querySelector('select[name="status"]');
  select.innerHTML = auth.statuses.map(
    (s) => `<option value="${s}"${s === lead.status ? " selected" : ""}>${statusLabel(s)}</option>`
  ).join("");
  form.querySelector('textarea[name="note"]').value = lead.lastNote || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = form.querySelector("button[type='submit']");
    const origHTML = btn.innerHTML;
    btn.disabled    = true;
    btn.textContent = "Salvando…";

    const res = await fetch(`/api/leads/${lead.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        status: select.value,
        note:   form.querySelector('textarea[name="note"]').value.trim(),
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      alert(payload.error || "Não foi possível atualizar o lead.");
      btn.disabled  = false;
      btn.innerHTML = origHTML;
      return;
    }
    await loadLeads();
  });

  return fragment;
}

/* ─── Load leads ─────────────────────── */
async function loadLeads() {
  const params = new URLSearchParams();
  if (statusFilter.value)       params.set("status",    statusFilter.value);
  if (operatorFilter.value)     params.set("operadora", operatorFilter.value);
  if (searchFilter.value.trim()) params.set("search",   searchFilter.value.trim());

  leadGrid.style.opacity = "0.5";
  const response = await fetch(`/api/leads?${params.toString()}`);
  const payload  = await response.json();

  leadGrid.innerHTML    = "";
  leadGrid.style.opacity = "1";
  resultCount.textContent = `${payload.leads.length} lead${payload.leads.length !== 1 ? "s" : ""} encontrado${payload.leads.length !== 1 ? "s" : ""}`;
  renderSummary(payload.leads);

  for (const lead of payload.leads) {
    leadGrid.appendChild(
      auth.user.role === "master" ? renderMasterLead(lead) : renderVendorLead(lead)
    );
  }
}

/* ─── Events ─────────────────────────── */
refreshBtn.addEventListener("click",  loadLeads);
statusFilter.addEventListener("change",   loadLeads);
operatorFilter.addEventListener("change", loadLeads);
searchFilter.addEventListener("input", () => {
  clearTimeout(searchFilter._timer);
  searchFilter._timer = setTimeout(loadLeads, 280);
});

exportBtn.addEventListener("click", () => { window.location.href = "/api/export/leads.xlsx"; });
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

/* ─── Init ───────────────────────────── */
(async () => {
  await loadAuth();
  await loadLeads();
})();

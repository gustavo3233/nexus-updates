const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { evaluateLicenseState, publicLicenseState } = require("../licensing.cjs");

const entities = ["clients", "budgets", "financial_sheets", "orders", "client_files", "works", "ledger_entries", "professionals", "work_days", "suppliers", "purchases", "documents", "products", "tools"];
const companyScopedTables = ["clients", "budgets", "budget_items", "budget_estimated_expenses", "financial_sheets", "financial_expenses", "works", "work_status_history", "work_daily_logs", "professionals", "work_days", "suppliers", "purchases", "documents", "ledger_entries", "ledger_payments", "orders", "client_files", "service_completions", "nfse_drafts", "dps_sequences", "nfse_records", "nfse_transmission_attempts", "nfse_artifacts", "nfse_events", "audit_log", "import_runs", "imported_sources", "financings", "products"];
const legacyCompanyId = "company-legacy-nexus";

function now() { return new Date().toISOString(); }
function checksum(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

class NexusStore {
  constructor(userDataPath) {
    this.root = path.join(userDataPath, "nexus-data");
    this.dbPath = path.join(this.root, "nexus.sqlite");
    this.db = null;
  }

  async open() {
    await fs.mkdir(this.root, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, source TEXT, source_id TEXT, UNIQUE(source, source_id));
      CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, issue_date TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, source TEXT, source_id TEXT, UNIQUE(source, source_id));
      CREATE TABLE IF NOT EXISTS budget_items (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL, FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS budget_estimated_expenses (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL, FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS financial_sheets (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, budget_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS financial_expenses (id TEXT PRIMARY KEY, sheet_id TEXT NOT NULL, position INTEGER NOT NULL, expense_date TEXT, data TEXT NOT NULL, FOREIGN KEY(sheet_id) REFERENCES financial_sheets(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL, budget_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS work_status_history (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, position INTEGER NOT NULL, status TEXT NOT NULL, happened_at TEXT NOT NULL, data TEXT NOT NULL, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS work_daily_logs (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, position INTEGER NOT NULL, log_date TEXT NOT NULL, data TEXT NOT NULL, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS professionals (id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS work_days (id TEXT PRIMARY KEY, professional_id TEXT NOT NULL, work_id TEXT NOT NULL, work_date TEXT NOT NULL, source_expense_id TEXT UNIQUE, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(professional_id, work_id, work_date));
      CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL, work_id TEXT, purchase_date TEXT NOT NULL, total_amount REAL NOT NULL, source_expense_id TEXT UNIQUE, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, budget_id TEXT, work_id TEXT, document_type TEXT NOT NULL, signature_status TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger_entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, client_id TEXT, budget_id TEXT, work_id TEXT, due_date TEXT, status TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger_payments (id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, payment_date TEXT NOT NULL, amount REAL NOT NULL, data TEXT NOT NULL, FOREIGN KEY(entry_id) REFERENCES ledger_entries(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS client_files (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, category TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, source TEXT, source_id TEXT, UNIQUE(source, source_id));
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, happened_at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, before_data TEXT, after_data TEXT, metadata TEXT);
      CREATE TABLE IF NOT EXISTS import_runs (id TEXT PRIMARY KEY, source TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, summary TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS imported_sources (source TEXT NOT NULL, source_id TEXT NOT NULL, entity TEXT NOT NULL, local_id TEXT NOT NULL, imported_at TEXT NOT NULL, PRIMARY KEY(source, source_id, entity));
      CREATE TABLE IF NOT EXISTS fiscal_settings (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS service_completions (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL UNIQUE, work_id TEXT, order_id TEXT, completed_on TEXT NOT NULL, confirmed_by TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(budget_id) REFERENCES budgets(id));
      CREATE TABLE IF NOT EXISTS nfse_drafts (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL, client_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL, UNIQUE(company_id,budget_id));
      CREATE TABLE IF NOT EXISTS dps_sequences (issuer_cnpj TEXT NOT NULL, series TEXT NOT NULL, next_number INTEGER NOT NULL CHECK(next_number > 0), updated_at TEXT NOT NULL, PRIMARY KEY(issuer_cnpj, series));
      CREATE TABLE IF NOT EXISTS nfse_records (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL, work_id TEXT, order_id TEXT, status TEXT NOT NULL, dps_series TEXT NOT NULL, dps_number INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(dps_series, dps_number));
      CREATE TABLE IF NOT EXISTS nfse_transmission_attempts (id TEXT PRIMARY KEY, nfse_id TEXT NOT NULL, status TEXT NOT NULL, operation TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(nfse_id) REFERENCES nfse_records(id));
      CREATE TABLE IF NOT EXISTS nfse_artifacts (id TEXT PRIMARY KEY, nfse_id TEXT NOT NULL, artifact_type TEXT NOT NULL, sha256 TEXT NOT NULL, storage_path TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(nfse_id, artifact_type, sha256), FOREIGN KEY(nfse_id) REFERENCES nfse_records(id));
      CREATE TABLE IF NOT EXISTS nfse_events (id TEXT PRIMARY KEY, nfse_id TEXT NOT NULL, event_type TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(nfse_id) REFERENCES nfse_records(id));
      CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, trade_name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_context (id INTEGER PRIMARY KEY CHECK(id = 1), active_company_id TEXT, updated_at TEXT NOT NULL, FOREIGN KEY(active_company_id) REFERENCES companies(id));
      CREATE TABLE IF NOT EXISTS company_settings (company_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));
      CREATE TABLE IF NOT EXISTS company_fiscal_settings (company_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));
      CREATE TABLE IF NOT EXISTS company_certificate_references (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, certificate_type TEXT NOT NULL, keychain_reference TEXT NOT NULL, certificate_cnpj TEXT, fingerprint TEXT, valid_until TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(company_id, fingerprint), FOREIGN KEY(company_id) REFERENCES companies(id));
      CREATE TABLE IF NOT EXISTS financings (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, work_id TEXT, budget_id TEXT NOT NULL, first_payment_date TEXT NOT NULL, installments_count INTEGER NOT NULL, total_financed REAL NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_users (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));
      CREATE TABLE IF NOT EXISTS company_licenses (company_id TEXT PRIMARY KEY, installation_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));
    `);
    this.migrateToMultiCompany();
    this.migrateFinancing();
    this.migrateFinancingSources();
    this.migrateProducts();
    this.migrateTools();
    this.migrateUserAccess();
    this.migrateLicensing();
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-nfse-foundation-v1", now());
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-nfse-technical-v2", now());
  }

  migrateFinancing() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-financing-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const columns = this.db.prepare("PRAGMA table_info(financings)").all();
      if (!columns.some((column) => column.name === "company_id")) this.db.exec("ALTER TABLE financings ADD COLUMN company_id TEXT");
      this.db.prepare("UPDATE financings SET company_id=? WHERE company_id IS NULL").run(legacyCompanyId);
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_financings_insert BEFORE INSERT ON financings WHEN NEW.company_id IS NOT NULL AND NEW.company_id != (SELECT active_company_id FROM app_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'empresa ativa inválida'); END;");
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_financings_move BEFORE UPDATE OF company_id ON financings WHEN OLD.company_id IS NOT NULL AND NEW.company_id != OLD.company_id BEGIN SELECT RAISE(ABORT, 'movimentação entre empresas não permitida'); END;");
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-financing-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateFinancingSources() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-financing-sources-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const columns = this.db.prepare("PRAGMA table_info(financings)").all();
      const workColumn = columns.find((column) => column.name === "work_id");
      if (workColumn?.notnull) {
        this.db.exec(`ALTER TABLE financings RENAME TO financings_legacy_sources;
          CREATE TABLE financings (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, work_id TEXT, budget_id TEXT NOT NULL, first_payment_date TEXT NOT NULL, installments_count INTEGER NOT NULL, total_financed REAL NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL);
          INSERT INTO financings (id,client_id,work_id,budget_id,first_payment_date,installments_count,total_financed,data,created_at,updated_at,company_id)
          SELECT id,client_id,work_id,budget_id,first_payment_date,installments_count,total_financed,data,created_at,updated_at,company_id FROM financings_legacy_sources;
          DROP TABLE financings_legacy_sources;`);
        this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_financings_insert BEFORE INSERT ON financings WHEN NEW.company_id IS NOT NULL AND NEW.company_id != (SELECT active_company_id FROM app_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'empresa ativa inválida'); END;");
        this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_financings_move BEFORE UPDATE OF company_id ON financings WHEN OLD.company_id IS NOT NULL AND NEW.company_id != OLD.company_id BEGIN SELECT RAISE(ABORT, 'movimentação entre empresas não permitida'); END;");
      }
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-financing-sources-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateProducts() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-products-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_products_insert BEFORE INSERT ON products WHEN NEW.company_id IS NOT NULL AND NEW.company_id != (SELECT active_company_id FROM app_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'empresa ativa inválida'); END;");
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_products_move BEFORE UPDATE OF company_id ON products WHEN OLD.company_id IS NOT NULL AND NEW.company_id != OLD.company_id BEGIN SELECT RAISE(ABORT, 'movimentação entre empresas não permitida'); END;");
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-products-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateTools() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-tools-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("CREATE TABLE IF NOT EXISTS tools (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));");
      this.db.exec("CREATE INDEX IF NOT EXISTS tools_company_status_idx ON tools(company_id,status);");
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_tools_insert BEFORE INSERT ON tools WHEN NEW.company_id != (SELECT active_company_id FROM app_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'empresa ativa inválida'); END;");
      this.db.exec("CREATE TRIGGER IF NOT EXISTS company_guard_tools_move BEFORE UPDATE OF company_id ON tools WHEN NEW.company_id != OLD.company_id BEGIN SELECT RAISE(ABORT, 'movimentação entre empresas não permitida'); END;");
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-tools-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateUserAccess() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-user-access-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const columns = this.db.prepare("PRAGMA table_info(app_users)").all();
      if (!columns.some((column) => column.name === "permissions_json")) this.db.exec("ALTER TABLE app_users ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '[]'");
      this.db.prepare("UPDATE app_users SET permissions_json='[]' WHERE permissions_json IS NULL OR permissions_json='' ").run();
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-user-access-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateLicensing() {
    if (this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-licensing-v1")) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("CREATE TABLE IF NOT EXISTS company_licenses (company_id TEXT PRIMARY KEY, installation_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(company_id) REFERENCES companies(id));");
      this.db.prepare("INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-licensing-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  migrateToMultiCompany() {
    const migrationDone = this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get("2026-11-multicompany-v1");
    if (migrationDone) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const table of companyScopedTables) {
        const hasColumn = this.db.prepare("PRAGMA table_info(" + table + ")").all().some((column) => column.name === "company_id");
        if (!hasColumn) this.db.exec("ALTER TABLE " + table + " ADD COLUMN company_id TEXT");
      }
      const nfseDefinition = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='nfse_records'").get()?.sql || "";
      if (nfseDefinition.includes("UNIQUE(dps_series, dps_number)")) {
        this.db.exec("PRAGMA foreign_keys = OFF;");
        this.db.exec("CREATE TABLE nfse_records_multi (id TEXT PRIMARY KEY, budget_id TEXT NOT NULL, client_id TEXT NOT NULL, work_id TEXT, order_id TEXT, status TEXT NOT NULL, dps_series TEXT NOT NULL, dps_number INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, company_id TEXT NOT NULL, UNIQUE(company_id,budget_id), UNIQUE(company_id,dps_series,dps_number));");
        this.db.exec("INSERT INTO nfse_records_multi (id,budget_id,client_id,work_id,order_id,status,dps_series,dps_number,data,created_at,updated_at,company_id) SELECT id,budget_id,client_id,work_id,order_id,status,dps_series,dps_number,data,created_at,updated_at,COALESCE(company_id,'company-legacy-nexus') FROM nfse_records;");
        this.db.exec("DROP TABLE nfse_records; ALTER TABLE nfse_records_multi RENAME TO nfse_records; PRAGMA foreign_keys = ON;");
      }
      const dpsDefinition = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='dps_sequences'").get()?.sql || "";
      if (dpsDefinition.includes("PRIMARY KEY(issuer_cnpj, series)")) {
        this.db.exec("CREATE TABLE dps_sequences_multi (issuer_cnpj TEXT NOT NULL, series TEXT NOT NULL, next_number INTEGER NOT NULL CHECK(next_number > 0), updated_at TEXT NOT NULL, company_id TEXT NOT NULL, PRIMARY KEY(company_id,issuer_cnpj,series));");
        this.db.exec("INSERT INTO dps_sequences_multi (issuer_cnpj,series,next_number,updated_at,company_id) SELECT issuer_cnpj,series,next_number,updated_at,COALESCE(company_id,'company-legacy-nexus') FROM dps_sequences; DROP TABLE dps_sequences; ALTER TABLE dps_sequences_multi RENAME TO dps_sequences;");
      }
      const existingCompany = this.db.prepare("SELECT id FROM companies WHERE id=?").get(legacyCompanyId);
      const hasHistoricalData = this.db.prepare("SELECT EXISTS(SELECT 1 FROM clients UNION SELECT 1 FROM budgets UNION SELECT 1 FROM settings) AS present").get().present;
      if (hasHistoricalData && !existingCompany) {
        const legacySettings = this.db.prepare("SELECT data FROM settings WHERE id=1").get()?.data;
        const settings = legacySettings ? JSON.parse(legacySettings) : {};
        const legalName = settings.companyName || "Nexus Construção e Reformas";
        this.db.prepare("INSERT INTO companies (id,legal_name,trade_name,data,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(legacyCompanyId, legalName, legalName, JSON.stringify({ id: legacyCompanyId, legalName, tradeName: legalName, migratedFrom: "single-company" }), now(), now());
        if (legacySettings) this.db.prepare("INSERT OR IGNORE INTO company_settings (company_id,data,updated_at) VALUES (?,?,?)").run(legacyCompanyId, legacySettings, now());
        const fiscalSettings = this.db.prepare("SELECT data FROM fiscal_settings WHERE id=1").get()?.data;
        if (fiscalSettings) this.db.prepare("INSERT OR IGNORE INTO company_fiscal_settings (company_id,data,updated_at) VALUES (?,?,?)").run(legacyCompanyId, fiscalSettings, now());
      }
      const active = this.db.prepare("SELECT active_company_id FROM app_context WHERE id=1").get();
      if (!active) this.db.prepare("INSERT INTO app_context (id,active_company_id,updated_at) VALUES (1,?,?)").run(hasHistoricalData ? legacyCompanyId : null, now());
      else if (!active.active_company_id && hasHistoricalData) this.db.prepare("UPDATE app_context SET active_company_id=?,updated_at=? WHERE id=1").run(legacyCompanyId, now());
      for (const table of companyScopedTables) this.db.prepare("UPDATE " + table + " SET company_id=? WHERE company_id IS NULL").run(legacyCompanyId);
      for (const table of companyScopedTables) {
        const safeName = table.replace(/[^a-z_]/g, "");
        this.db.exec(`CREATE TRIGGER IF NOT EXISTS company_guard_${safeName}_insert BEFORE INSERT ON ${table} WHEN NEW.company_id IS NOT NULL AND NEW.company_id != (SELECT active_company_id FROM app_context WHERE id=1) BEGIN SELECT RAISE(ABORT, 'empresa ativa inválida'); END;`);
        this.db.exec(`CREATE TRIGGER IF NOT EXISTS company_guard_${safeName}_move BEFORE UPDATE OF company_id ON ${table} WHEN OLD.company_id IS NOT NULL AND NEW.company_id != OLD.company_id BEGIN SELECT RAISE(ABORT, 'movimentação entre empresas não permitida'); END;`);
      }
      this.db.prepare("INSERT OR IGNORE INTO schema_migrations (version,applied_at) VALUES (?,?)").run("2026-11-multicompany-v1", now());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  activeCompanyId() { return this.db.prepare("SELECT active_company_id FROM app_context WHERE id=1").get()?.active_company_id || null; }
  requireActiveCompany() { const id = this.activeCompanyId(); if (!id) throw new Error("Nenhuma empresa ativa. Cadastre ou selecione uma empresa antes de operar o ERP."); return id; }
  listCompanies() { return this.db.prepare("SELECT data FROM companies ORDER BY trade_name").all().map((row) => JSON.parse(row.data)); }
  activeCompany() { const id = this.activeCompanyId(); return id ? this.listCompanies().find((company) => company.id === id) || null : null; }
  bootstrap() {
    const companyId = this.activeCompanyId();
    const settings = companyId ? this.db.prepare("SELECT data FROM company_settings WHERE company_id=?").get(companyId)?.data : null;
    return { activeCompany: this.activeCompany(), settings: settings ? JSON.parse(settings) : null };
  }
  createCompany(company) { const timestamp = now(); const legalName = String(company.legalName || "").trim(); const tradeName = String(company.tradeName || legalName).trim() || legalName; const stored = { id: company.id || crypto.randomUUID(), legalName, tradeName, createdAt: timestamp, updatedAt: timestamp }; if (!stored.legalName) throw new Error("Informe a razão social da empresa."); this.db.prepare("INSERT INTO companies (id,legal_name,trade_name,data,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(stored.id, stored.legalName, stored.tradeName, JSON.stringify(stored), timestamp, timestamp); if (!this.activeCompanyId()) this.setActiveCompany(stored.id); return stored; }
  setActiveCompany(companyId) { if (!this.db.prepare("SELECT id FROM companies WHERE id=?").get(companyId)) throw new Error("Empresa não encontrada."); this.db.prepare("UPDATE app_context SET active_company_id=?,updated_at=? WHERE id=1").run(companyId, now()); return companyId; }

  authStatus() { return { hasUsers: Boolean(this.db.prepare("SELECT 1 FROM app_users LIMIT 1").get()), activeCompany: this.activeCompany() }; }
  normalizeUsername(value) { return String(value || "").trim().toLocaleLowerCase("pt-BR"); }
  validateUsername(username) { const normalized = this.normalizeUsername(username); if (!/^[a-z0-9._-]{3,40}$/.test(normalized)) throw new Error("Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado."); return normalized; }
  validateCredentials(username, password) { const normalized = this.validateUsername(username); if (typeof password !== "string" || password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres."); return normalized; }
  validPermissions() { return ["dashboard.view", "clients.manage", "budgets.manage", "works.manage", "professionals.manage", "suppliers.manage", "products.manage", "tools.manage", "documents.manage", "finance.manage", "cashflow.manage", "financing.manage", "settings.manage"]; }
  normalizePermissions(value) { const values = Array.isArray(value) ? value : []; const valid = new Set(this.validPermissions()); return [...new Set(values.map(String).filter((permission) => valid.has(permission)))]; }
  publicUser(row) { let permissions = []; try { permissions = JSON.parse(row.permissions_json || "[]"); } catch { permissions = []; } return { id: row.id, companyId: row.company_id, username: row.username, displayName: row.display_name, role: row.role, permissions: row.role === "super_admin" ? ["*"] : this.normalizePermissions(permissions), active: Boolean(row.active) }; }
  setupAdmin(input) {
    if (this.authStatus().hasUsers) throw new Error("Já existe um usuário administrador configurado.");
    const username = this.validateCredentials(input.username, input.password); const companyId = this.requireActiveCompany(); const timestamp = now(); const salt = crypto.randomBytes(16).toString("hex"); const hash = crypto.scryptSync(input.password, salt, 64).toString("hex"); const id = crypto.randomUUID(); const displayName = String(input.displayName || input.username).trim() || input.username;
    this.db.prepare("INSERT INTO app_users (id,company_id,username,display_name,role,password_hash,password_salt,active,permissions_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, companyId, username, displayName, "super_admin", hash, salt, 1, '["*"]', timestamp, timestamp);
    this.audit("created", "user", id, null, { username, role: "super_admin" }); return this.publicUser(this.db.prepare("SELECT * FROM app_users WHERE id=?").get(id));
  }
  authenticate(input) { const username = this.normalizeUsername(input.username); const row = this.db.prepare("SELECT * FROM app_users WHERE username=? AND active=1").get(username); if (!row) throw new Error("Usuário ou senha inválidos."); const attempted = crypto.scryptSync(String(input.password || ""), row.password_salt, 64); const stored = Buffer.from(row.password_hash, "hex"); if (attempted.length !== stored.length || !crypto.timingSafeEqual(attempted, stored)) throw new Error("Usuário ou senha inválidos."); this.setActiveCompany(row.company_id); return this.publicUser(row); }
  updateCurrentUser(userId, input) { const row = this.db.prepare("SELECT * FROM app_users WHERE id=? AND active=1").get(userId); if (!row) throw new Error("Usuário não encontrado."); const username = input.username ? this.validateUsername(input.username) : row.username; const password = input.password ? String(input.password) : null; if (password && password.length < 8) throw new Error("A nova senha deve ter pelo menos 8 caracteres."); const salt = password ? crypto.randomBytes(16).toString("hex") : row.password_salt; const hash = password ? crypto.scryptSync(password, salt, 64).toString("hex") : row.password_hash; const displayName = String(input.displayName || row.display_name).trim() || row.display_name; this.db.prepare("UPDATE app_users SET username=?,display_name=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?").run(username, displayName, hash, salt, now(), userId); const updated = this.db.prepare("SELECT * FROM app_users WHERE id=?").get(userId); this.audit("updated", "user", userId, { username: row.username }, { username, displayName }); return this.publicUser(updated); }
  requireSuperAdmin(userId) { const user = this.db.prepare("SELECT * FROM app_users WHERE id=? AND active=1").get(userId); if (!user || user.company_id !== this.requireActiveCompany() || user.role !== "super_admin") throw new Error("Somente o administrador principal pode gerenciar usuários."); return user; }
  listUsers(requesterId) { this.requireSuperAdmin(requesterId); const companyId = this.requireActiveCompany(); return this.db.prepare("SELECT * FROM app_users WHERE company_id=? ORDER BY display_name COLLATE NOCASE").all(companyId).map((row) => this.publicUser(row)); }
  createUser(requesterId, input) { this.requireSuperAdmin(requesterId); const username = this.validateCredentials(input.username, input.password); const companyId = this.requireActiveCompany(); const role = ["admin", "financeiro", "operacional", "visualizador"].includes(input.role) ? input.role : "visualizador"; const timestamp = now(); const id = crypto.randomUUID(); const salt = crypto.randomBytes(16).toString("hex"); const hash = crypto.scryptSync(input.password, salt, 64).toString("hex"); const displayName = String(input.displayName || input.username).trim() || username; const permissions = this.normalizePermissions(input.permissions); this.db.prepare("INSERT INTO app_users (id,company_id,username,display_name,role,password_hash,password_salt,active,permissions_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, companyId, username, displayName, role, hash, salt, 1, JSON.stringify(permissions), timestamp, timestamp); const user = this.db.prepare("SELECT * FROM app_users WHERE id=?").get(id); this.audit("created", "user", id, null, { username, role, permissions }); return this.publicUser(user); }
  updateUser(requesterId, userId, input) { const requester = this.requireSuperAdmin(requesterId); const companyId = this.requireActiveCompany(); const current = this.db.prepare("SELECT * FROM app_users WHERE id=? AND company_id=?").get(userId, companyId); if (!current) throw new Error("Usuário não encontrado nesta empresa."); if (current.role === "super_admin") throw new Error("A conta do administrador principal só pode ser alterada em Conta e acesso."); const username = input.username ? this.validateUsername(input.username) : current.username; const displayName = String(input.displayName || current.display_name).trim() || current.display_name; const role = ["admin", "financeiro", "operacional", "visualizador"].includes(input.role) ? input.role : current.role; const permissions = input.permissions ? this.normalizePermissions(input.permissions) : this.normalizePermissions(JSON.parse(current.permissions_json || "[]")); const active = typeof input.active === "boolean" ? Number(input.active) : current.active; const password = input.password ? String(input.password) : null; if (password && password.length < 8) throw new Error("A nova senha deve ter pelo menos 8 caracteres."); const salt = password ? crypto.randomBytes(16).toString("hex") : current.password_salt; const hash = password ? crypto.scryptSync(password, salt, 64).toString("hex") : current.password_hash; if (requester.id === userId && !active) throw new Error("O administrador atual não pode desativar a própria conta."); this.db.prepare("UPDATE app_users SET username=?,display_name=?,role=?,password_hash=?,password_salt=?,active=?,permissions_json=?,updated_at=? WHERE id=? AND company_id=?").run(username, displayName, role, hash, salt, active, JSON.stringify(permissions), now(), userId, companyId); const updated = this.db.prepare("SELECT * FROM app_users WHERE id=?").get(userId); this.audit("updated", "user", userId, { username: current.username, active: Boolean(current.active) }, { username, role, active: Boolean(active), permissions }); return this.publicUser(updated); }

  audit(action, entity, entityId, before, after, metadata) {
    const companyId = this.activeCompanyId();
    this.db.prepare("INSERT INTO audit_log (id,happened_at,actor,action,entity,entity_id,before_data,after_data,metadata,company_id) VALUES (?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), now(), "local-system", action, entity, entityId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, metadata ? JSON.stringify(metadata) : null, companyId);
  }

  setMeta(key, value) { this.db.prepare("INSERT INTO app_meta (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(key, value, now()); }
  getMeta(key) { return this.db.prepare("SELECT value FROM app_meta WHERE key=?").get(key)?.value ?? null; }
  installationId() {
    const existing = this.getMeta("installation_id_v1");
    if (existing) return existing;
    const installationId = crypto.randomUUID();
    this.setMeta("installation_id_v1", installationId);
    return installationId;
  }
  licenseRow(companyId) { return this.db.prepare("SELECT data FROM company_licenses WHERE company_id=?").get(companyId); }
  ensureLicense(companyId = this.requireActiveCompany()) {
    const existing = this.licenseRow(companyId);
    if (existing) return JSON.parse(existing.data);
    const startedAt = now();
    const state = { type: "trial", installationId: this.installationId(), startedAt, expiresAt: new Date(Date.parse(startedAt) + 7 * 24 * 60 * 60 * 1000).toISOString(), lastCheckedAt: startedAt, planCode: "trial-7" };
    this.db.prepare("INSERT INTO company_licenses (company_id,installation_id,data,created_at,updated_at) VALUES (?,?,?,?,?)").run(companyId, state.installationId, JSON.stringify(state), startedAt, startedAt);
    this.audit("created", "license", companyId, null, publicLicenseState(state), { source: "local-trial" });
    return state;
  }
  licenseStatus(companyId = this.activeCompanyId()) {
    if (!companyId) return { state: "onboarding", active: true, message: "O período de teste começará após o cadastro da empresa." };
    const state = this.ensureLicense(companyId);
    const evaluation = evaluateLicenseState(state);
    if (evaluation.nextState) {
      this.db.prepare("UPDATE company_licenses SET data=?,updated_at=? WHERE company_id=?").run(JSON.stringify(evaluation.nextState), now(), companyId);
    }
    return publicLicenseState({ ...state, ...evaluation, ...(evaluation.nextState ? { lastCheckedAt: evaluation.nextState.lastCheckedAt } : {}) });
  }
  licenseActivationContext(companyId = this.requireActiveCompany()) {
    const settings = this.db.prepare("SELECT data FROM company_settings WHERE company_id=?").get(companyId)?.data;
    const company = this.db.prepare("SELECT legal_name,trade_name FROM companies WHERE id=?").get(companyId);
    const parsed = settings ? JSON.parse(settings) : {};
    return { companyId, installationId: this.ensureLicense(companyId).installationId, companyName: String(parsed.companyName || company?.trade_name || company?.legal_name || ""), companyDocument: String(parsed.cnpj || "").replace(/\D/g, "") };
  }
  applyLicenseActivation(companyId, activation) {
    const current = this.ensureLicense(companyId);
    const license = activation?.license;
    if (!license || license.installationId !== current.installationId || license.status !== "active" || !license.expiresAt || !activation.token) throw new Error("A ativação retornada pelo serviço é inválida.");
    const next = { type: "subscription", installationId: current.installationId, licenseId: String(license.licenseId), planCode: String(license.planCode || "subscription"), expiresAt: String(license.expiresAt), lastCheckedAt: now(), lastValidatedAt: now(), token: String(activation.token) };
    const before = publicLicenseState(current);
    this.db.prepare("UPDATE company_licenses SET data=?,updated_at=? WHERE company_id=?").run(JSON.stringify(next), now(), companyId);
    this.audit("activated", "license", companyId, before, publicLicenseState(next), { licenseId: next.licenseId, planCode: next.planCode });
    return this.licenseStatus(companyId);
  }

  save(entity, record, source = null, sourceId = null, audit = true) {
    if (!entities.includes(entity)) throw new Error("Entidade inválida: " + entity);
    const companyId = this.requireActiveCompany();
    if (record.companyId && record.companyId !== companyId) throw new Error("A empresa informada não corresponde à empresa ativa.");
    const anyExisting = this.db.prepare("SELECT company_id FROM " + ({ clients: "clients", budgets: "budgets", financial_sheets: "financial_sheets", orders: "orders", client_files: "client_files", works: "works", ledger_entries: "ledger_entries", professionals: "professionals", work_days: "work_days", suppliers: "suppliers", purchases: "purchases", documents: "documents", products: "products", tools: "tools" })[entity] + " WHERE id=?").get(record.id);
    if (anyExisting && anyExisting.company_id !== companyId) throw new Error("Acesso negado: o registro pertence a outra empresa.");
    const storedRecord = { ...record, companyId };
    const existing = this.getById(entity, record.id);
    const timestamp = now();
    const json = JSON.stringify(storedRecord);
    if (entity === "clients") this.db.prepare("INSERT INTO clients (id,name,active,data,created_at,updated_at,source,source_id,company_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at,source=COALESCE(excluded.source,clients.source),source_id=COALESCE(excluded.source_id,clients.source_id)").run(record.id, record.name, record.active === false ? 0 : 1, json, record.createdAt || timestamp, timestamp, source, sourceId, companyId);
    if (entity === "budgets") {
      if (!this.getById("clients", record.clientId)) throw new Error("Cliente inválido ou pertence a outra empresa.");
      this.db.prepare("INSERT INTO budgets (id,client_id,title,status,issue_date,data,created_at,updated_at,source,source_id,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,title=excluded.title,status=excluded.status,issue_date=excluded.issue_date,data=excluded.data,updated_at=excluded.updated_at,source=COALESCE(excluded.source,budgets.source),source_id=COALESCE(excluded.source_id,budgets.source_id)").run(record.id, record.clientId, record.title, record.status, record.issueDate || null, json, record.createdAt || timestamp, timestamp, source, sourceId, companyId);
      this.db.prepare("DELETE FROM budget_items WHERE budget_id=? AND company_id=?").run(record.id, companyId); this.db.prepare("DELETE FROM budget_estimated_expenses WHERE budget_id=? AND company_id=?").run(record.id, companyId);
      (record.items || []).forEach((item, position) => this.db.prepare("INSERT INTO budget_items (id,budget_id,position,data,company_id) VALUES (?,?,?,?,?)").run(item.id, record.id, position, JSON.stringify(item), companyId));
      (record.estimatedExpenses || []).forEach((expense, position) => this.db.prepare("INSERT INTO budget_estimated_expenses (id,budget_id,position,data,company_id) VALUES (?,?,?,?,?)").run(expense.id, record.id, position, JSON.stringify(expense), companyId));
    }
    if (entity === "financial_sheets") {
      if (!this.getById("clients", record.clientId) || !this.getById("budgets", record.budgetId)) throw new Error("Cliente ou orçamento inválido para a empresa ativa.");
      this.db.prepare("INSERT INTO financial_sheets (id,client_id,budget_id,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,budget_id=excluded.budget_id,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.clientId, record.budgetId, json, record.createdAt || timestamp, timestamp, companyId);
      this.db.prepare("DELETE FROM financial_expenses WHERE sheet_id=? AND company_id=?").run(record.id, companyId);
      (record.expenses || []).forEach((expense, position) => this.db.prepare("INSERT INTO financial_expenses (id,sheet_id,position,expense_date,data,company_id) VALUES (?,?,?,?,?,?)").run(expense.id, record.id, position, expense.date || null, JSON.stringify(expense), companyId));
    }
    if (entity === "works") {
      if (!this.getById("clients", record.clientId) || !this.getById("budgets", record.budgetId)) throw new Error("Cliente ou orçamento inválido para a empresa ativa.");
      this.db.prepare("INSERT INTO works (id,number,client_id,budget_id,status,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET number=excluded.number,client_id=excluded.client_id,budget_id=excluded.budget_id,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.number, record.clientId, record.budgetId, record.status, json, record.createdAt || timestamp, timestamp, companyId);
      this.db.prepare("DELETE FROM work_status_history WHERE work_id=? AND company_id=?").run(record.id, companyId); this.db.prepare("DELETE FROM work_daily_logs WHERE work_id=? AND company_id=?").run(record.id, companyId);
      (record.statusHistory || []).forEach((entry, position) => this.db.prepare("INSERT INTO work_status_history (id,work_id,position,status,happened_at,data,company_id) VALUES (?,?,?,?,?,?,?)").run(entry.id, record.id, position, entry.status, entry.happenedAt, JSON.stringify(entry), companyId));
      (record.dailyLogs || []).forEach((entry, position) => this.db.prepare("INSERT INTO work_daily_logs (id,work_id,position,log_date,data,company_id) VALUES (?,?,?,?,?,?)").run(entry.id, record.id, position, entry.date, JSON.stringify(entry), companyId));
    }
    if (entity === "professionals") this.db.prepare("INSERT INTO professionals (id,name,active,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.name, record.active === false ? 0 : 1, json, record.createdAt || timestamp, timestamp, companyId);
    if (entity === "work_days") { if (!this.getById("professionals", record.professionalId) || !this.getById("works", record.workId)) throw new Error("Profissional ou obra inválido para a empresa ativa."); this.db.prepare("INSERT INTO work_days (id,professional_id,work_id,work_date,source_expense_id,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET professional_id=excluded.professional_id,work_id=excluded.work_id,work_date=excluded.work_date,source_expense_id=COALESCE(excluded.source_expense_id,work_days.source_expense_id),data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.professionalId, record.workId, record.date, record.sourceExpenseId || null, json, record.createdAt || timestamp, timestamp, companyId); }
    if (entity === "suppliers") this.db.prepare("INSERT INTO suppliers (id,name,active,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.name, record.active === false ? 0 : 1, json, record.createdAt || timestamp, timestamp, companyId);
    if (entity === "products") {
      if (!String(record.name || "").trim()) throw new Error("Informe o nome do produto.");
      const stockQuantity = Number(record.stockQuantity ?? 0);
      const minimumStock = Number(record.minimumStock ?? 0);
      if (!Number.isFinite(stockQuantity) || stockQuantity < 0 || !Number.isFinite(minimumStock) || minimumStock < 0) throw new Error("Quantidade em estoque e estoque mínimo devem ser valores válidos.");
      const movements = Array.isArray(record.stockHistory) ? record.stockHistory : [];
      movements.forEach((movement) => {
        if (!movement?.id || !movement?.type || !Number.isFinite(Number(movement.quantity))) throw new Error("Movimentação de estoque inválida.");
        if (movement.clientId && !this.getById("clients", movement.clientId)) throw new Error("Cliente da movimentação de estoque inválido para a empresa ativa.");
        if (movement.workId && !this.getById("works", movement.workId)) throw new Error("Obra da movimentação de estoque inválida para a empresa ativa.");
        if (movement.budgetId && !this.getById("budgets", movement.budgetId)) throw new Error("Orçamento da movimentação de estoque inválido para a empresa ativa.");
      });
      this.db.prepare("INSERT INTO products (id,name,category,active,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.name.trim(), record.category, record.active === false ? 0 : 1, json, record.createdAt || timestamp, timestamp, companyId);
    }
    if (entity === "tools") {
      const statuses = ["No depósito", "Em uso", "Extraviada", "Danificada", "Em manutenção"];
      if (!String(record.name || "").trim()) throw new Error("Informe o nome da ferramenta.");
      if (!statuses.includes(record.status)) throw new Error("Situação da ferramenta inválida.");
      const assignment = record.assignment || null;
      if (record.status === "Em uso") {
        if (!assignment?.expectedReturnDate || !(String(assignment.professionalName || "").trim() || assignment.professionalId)) throw new Error("Informe o responsável e a previsão de devolução para registrar a ferramenta em uso.");
        if ((assignment.professionalId && !this.getById("professionals", assignment.professionalId)) || (assignment.workId && !this.getById("works", assignment.workId))) throw new Error("Profissional ou obra inválido para a empresa ativa.");
      }
      this.db.prepare("INSERT INTO tools (id,name,status,active,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,active=excluded.active,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.name.trim(), record.status, record.active === false ? 0 : 1, json, record.createdAt || timestamp, timestamp, companyId);
    }
    if (entity === "purchases") { if (!this.getById("suppliers", record.supplierId) || (record.workId && !this.getById("works", record.workId))) throw new Error("Fornecedor ou obra inválido para a empresa ativa."); this.db.prepare("INSERT INTO purchases (id,supplier_id,work_id,purchase_date,total_amount,source_expense_id,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET supplier_id=excluded.supplier_id,work_id=excluded.work_id,purchase_date=excluded.purchase_date,total_amount=excluded.total_amount,source_expense_id=COALESCE(excluded.source_expense_id,purchases.source_expense_id),data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.supplierId, record.workId || null, record.date, Number(record.totalAmount) || 0, record.sourceExpenseId || null, json, record.createdAt || timestamp, timestamp, companyId); }
    if (entity === "documents") { if (!this.getById("clients", record.clientId) || (record.budgetId && !this.getById("budgets", record.budgetId)) || (record.workId && !this.getById("works", record.workId))) throw new Error("Vínculo de documento inválido para a empresa ativa."); this.db.prepare("INSERT INTO documents (id,client_id,budget_id,work_id,document_type,signature_status,version,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,budget_id=excluded.budget_id,work_id=excluded.work_id,document_type=excluded.document_type,signature_status=excluded.signature_status,version=excluded.version,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.clientId, record.budgetId || null, record.workId || null, record.type, record.signatureStatus, record.version, json, record.createdAt || timestamp, timestamp, companyId); }
    if (entity === "ledger_entries") {
      this.db.prepare("INSERT INTO ledger_entries (id,kind,client_id,budget_id,work_id,due_date,status,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,client_id=excluded.client_id,budget_id=excluded.budget_id,work_id=excluded.work_id,due_date=excluded.due_date,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.kind, record.clientId || null, record.budgetId || null, record.workId || null, record.dueDate || null, record.status, json, record.createdAt || timestamp, timestamp, companyId);
      this.db.prepare("DELETE FROM ledger_payments WHERE entry_id=? AND company_id=?").run(record.id, companyId);
      (record.payments || []).forEach((payment) => this.db.prepare("INSERT INTO ledger_payments (id,entry_id,payment_date,amount,data,company_id) VALUES (?,?,?,?,?,?)").run(payment.id, record.id, payment.date, payment.amount, JSON.stringify(payment), companyId));
    }
    if (entity === "orders") { if (!this.getById("clients", record.clientId)) throw new Error("Cliente inválido para a empresa ativa."); this.db.prepare("INSERT INTO orders (id,client_id,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,data=excluded.data,updated_at=excluded.updated_at").run(record.id, record.clientId, json, record.createdAt || timestamp, timestamp, companyId); }
    if (entity === "client_files") { if (!this.getById("clients", record.clientId)) throw new Error("Cliente inválido para a empresa ativa."); this.db.prepare("INSERT INTO client_files (id,client_id,category,data,created_at,updated_at,source,source_id,company_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,category=excluded.category,data=excluded.data,updated_at=excluded.updated_at,source=COALESCE(excluded.source,client_files.source),source_id=COALESCE(excluded.source_id,client_files.source_id)").run(record.id, record.clientId, record.category, json, record.createdAt || timestamp, timestamp, source, sourceId, companyId); }
    if (source && sourceId) this.db.prepare("INSERT INTO imported_sources (source,source_id,entity,local_id,imported_at,company_id) VALUES (?,?,?,?,?,?) ON CONFLICT(source,source_id,entity) DO UPDATE SET local_id=excluded.local_id,imported_at=excluded.imported_at").run(source, String(sourceId), entity, record.id, timestamp, companyId);
    if (audit) this.audit(existing ? "updated" : "created", entity, record.id, existing, record, source ? { source, sourceId } : null);
    return storedRecord;
  }

  getById(entity, id) {
    const tables = { clients: "clients", budgets: "budgets", financial_sheets: "financial_sheets", orders: "orders", client_files: "client_files", works: "works", ledger_entries: "ledger_entries", professionals: "professionals", work_days: "work_days", suppliers: "suppliers", purchases: "purchases", documents: "documents", products: "products", tools: "tools" };
    if (!tables[entity]) throw new Error("Entidade inválida: " + entity);
    const row = this.db.prepare("SELECT data FROM " + tables[entity] + " WHERE id=? AND company_id=?").get(id, this.requireActiveCompany());
    return row ? JSON.parse(row.data) : null;
  }

  delete(entity, id) {
    const tables = { clients: "clients", budgets: "budgets", financial_sheets: "financial_sheets", orders: "orders", client_files: "client_files", works: "works", ledger_entries: "ledger_entries", professionals: "professionals", work_days: "work_days", suppliers: "suppliers", purchases: "purchases", documents: "documents", products: "products", tools: "tools" };
    const existing = this.getById(entity, id);
    if (!existing) throw new Error("Registro não encontrado ou pertence a outra empresa.");
    this.db.prepare("DELETE FROM " + tables[entity] + " WHERE id=? AND company_id=?").run(id, this.requireActiveCompany());
    this.audit("deleted", entity, id, existing, null);
  }

  deleteOrder(orderId) {
    const companyId = this.requireActiveCompany();
    const order = this.getById("orders", orderId);
    if (!order) throw new Error("Pedido não encontrado ou pertence a outra empresa.");
    const linkedBudget = this.db.prepare("SELECT 1 FROM budgets WHERE company_id=? AND json_extract(data, '$.sourceOrderId')=? LIMIT 1").get(companyId, orderId);
    if (linkedBudget) throw new Error("Este pedido já possui um orçamento vinculado e não pode ser excluído.");
    this.db.prepare("DELETE FROM orders WHERE id=? AND company_id=?").run(orderId, companyId);
    this.audit("deleted", "orders", orderId, order, null);
  }

  deleteBudget(budgetId) {
    const companyId = this.requireActiveCompany();
    const budget = this.getById("budgets", budgetId);
    if (!budget) throw new Error("Orçamento não encontrado ou pertence a outra empresa.");
    if (this.db.prepare("SELECT 1 FROM nfse_records WHERE budget_id=? AND company_id=?").get(budgetId, companyId)) {
      throw new Error("Este orçamento possui registro fiscal. A exclusão é bloqueada para preservar o histórico de NFS-e/DPS.");
    }
    if (this.db.prepare("SELECT 1 FROM financings WHERE budget_id=? AND company_id=?").get(budgetId, companyId)) {
      throw new Error("Este orçamento possui financiamento. A exclusão é bloqueada para preservar o histórico financeiro.");
    }
    const works = this.db.prepare("SELECT id FROM works WHERE budget_id=? AND company_id=?").all(budgetId, companyId).map((row) => row.id);
    const count = (table, where, ...params) => this.db.prepare(`SELECT count(*) AS total FROM ${table} WHERE ${where}`).get(...params).total;
    const summary = {
      works: works.length,
      financialSheets: count("financial_sheets", "budget_id=? AND company_id=?", budgetId, companyId),
      documents: count("documents", "budget_id=? AND company_id=?", budgetId, companyId),
      ledgerEntries: count("ledger_entries", "budget_id=? AND company_id=?", budgetId, companyId),
      workDays: 0,
      purchases: 0
    };
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM documents WHERE budget_id=? AND company_id=?").run(budgetId, companyId);
      this.db.prepare("DELETE FROM ledger_entries WHERE budget_id=? AND company_id=?").run(budgetId, companyId);
      this.db.prepare("DELETE FROM financial_sheets WHERE budget_id=? AND company_id=?").run(budgetId, companyId);
      for (const workId of works) {
        summary.documents += count("documents", "work_id=? AND company_id=?", workId, companyId);
        summary.ledgerEntries += count("ledger_entries", "work_id=? AND company_id=?", workId, companyId);
        summary.workDays += count("work_days", "work_id=? AND company_id=?", workId, companyId);
        summary.purchases += count("purchases", "work_id=? AND company_id=?", workId, companyId);
        this.db.prepare("DELETE FROM documents WHERE work_id=? AND company_id=?").run(workId, companyId);
        this.db.prepare("DELETE FROM ledger_entries WHERE work_id=? AND company_id=?").run(workId, companyId);
        this.db.prepare("DELETE FROM work_days WHERE work_id=? AND company_id=?").run(workId, companyId);
        this.db.prepare("DELETE FROM purchases WHERE work_id=? AND company_id=?").run(workId, companyId);
        this.db.prepare("DELETE FROM works WHERE id=? AND company_id=?").run(workId, companyId);
      }
      this.db.prepare("DELETE FROM service_completions WHERE budget_id=? AND company_id=?").run(budgetId, companyId);
      this.db.prepare("DELETE FROM nfse_drafts WHERE budget_id=? AND company_id=?").run(budgetId, companyId);
      this.db.prepare("DELETE FROM imported_sources WHERE entity='budgets' AND local_id=? AND company_id=?").run(budgetId, companyId);
      this.db.prepare("DELETE FROM budgets WHERE id=? AND company_id=?").run(budgetId, companyId);
      this.audit("deleted", "budgets", budgetId, budget, null, { cascade: summary, irreversibleInApp: true });
      this.db.exec("COMMIT");
      return summary;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveWorkDayAndExpense(day) {
    const work = this.getById("works", day.workId);
    const professional = this.getById("professionals", day.professionalId);
    if (!work) throw new Error("A obra selecionada não foi encontrada.");
    if (!professional) throw new Error("O profissional selecionado não foi encontrado.");
    const companyId = this.requireActiveCompany();
    const duplicate = this.db.prepare("SELECT id FROM work_days WHERE professional_id=? AND work_id=? AND work_date=? AND company_id=?").get(day.professionalId, day.workId, day.date, companyId);
    if (duplicate && duplicate.id !== day.id) throw new Error("Já existe uma diária desse profissional para esta obra nesta data.");
    const timestamp = now();
    const existing = this.getById("work_days", day.id);
    const expenseId = existing?.sourceExpenseId || day.sourceExpenseId || crypto.randomUUID();
    const storedDay = { ...day, sourceExpenseId: expenseId, createdAt: day.createdAt || timestamp, updatedAt: timestamp };
    this.db.exec("BEGIN");
    try {
      this.save("work_days", storedDay, null, null, false);
      const sheets = this.db.prepare("SELECT data FROM financial_sheets WHERE budget_id=? AND company_id=?").all(work.budgetId, companyId).map((row) => JSON.parse(row.data));
      const existingSheet = sheets[0];
      const sheet = existingSheet || { id: crypto.randomUUID(), clientId: work.clientId, budgetId: work.budgetId, createdAt: timestamp, updatedAt: timestamp, expenses: [] };
      const expense = { id: expenseId, sourceId: storedDay.id, date: storedDay.date, category: "funcionario", description: "Diária: " + professional.name, amount: Number(storedDay.dailyRate || 0) + Number(storedDay.overtimeAmount || 0) };
      const nextSheet = { ...sheet, updatedAt: timestamp, expenses: [expense, ...(sheet.expenses || []).filter((item) => item.id !== expenseId && item.sourceId !== storedDay.id)] };
      this.save("financial_sheets", nextSheet, null, null, false);
      this.audit(existing ? "updated" : "created", "work_days", storedDay.id, existing, storedDay, { automaticExpenseId: expenseId });
      this.audit(existingSheet ? "updated" : "created", "financial_sheets", nextSheet.id, existingSheet || null, nextSheet, { source: "work_day", workDayId: storedDay.id });
      this.db.exec("COMMIT");
      return { day: storedDay, financialSheet: nextSheet };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  savePurchaseAndExpense(purchase) {
    const supplier = this.getById("suppliers", purchase.supplierId);
    if (!supplier) throw new Error("O fornecedor selecionado não foi encontrado.");
    const work = purchase.workId ? this.getById("works", purchase.workId) : null;
    if (purchase.workId && !work) throw new Error("A obra selecionada não foi encontrada.");
    const timestamp = now(); const existing = this.getById("purchases", purchase.id);
    const expenseId = work ? (existing?.sourceExpenseId || purchase.sourceExpenseId || crypto.randomUUID()) : undefined;
    const stored = { ...purchase, sourceExpenseId: expenseId, createdAt: purchase.createdAt || timestamp, updatedAt: timestamp };
    this.db.exec("BEGIN");
    try {
      this.save("purchases", stored, null, null, false);
      let financialSheet = null;
      if (work) {
        const existingSheet = this.db.prepare("SELECT data FROM financial_sheets WHERE budget_id=? AND company_id=?").all(work.budgetId, this.requireActiveCompany()).map((row) => JSON.parse(row.data))[0];
        const sheet = existingSheet || { id: crypto.randomUUID(), clientId: work.clientId, budgetId: work.budgetId, createdAt: timestamp, updatedAt: timestamp, expenses: [] };
        const description = "Compra: " + supplier.name + " — " + (stored.items || []).map((item) => item.description).filter(Boolean).join(", ");
        const expense = { id: expenseId, sourceId: stored.id, date: stored.date, category: "materiais", description: description.slice(0, 240) || "Compra de materiais", amount: Number(stored.totalAmount) || 0 };
        financialSheet = { ...sheet, updatedAt: timestamp, expenses: [expense, ...(sheet.expenses || []).filter((item) => item.id !== expenseId && item.sourceId !== stored.id)] };
        this.save("financial_sheets", financialSheet, null, null, false);
        this.audit(existingSheet ? "updated" : "created", "financial_sheets", financialSheet.id, existingSheet || null, financialSheet, { source: "purchase", purchaseId: stored.id });
      }
      this.audit(existing ? "updated" : "created", "purchases", stored.id, existing, stored, { automaticExpenseId: expenseId || null });
      this.db.exec("COMMIT"); return { purchase: stored, financialSheet };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveSettings(settings, audit = true) {
    const companyId = this.requireActiveCompany();
    const existing = this.db.prepare("SELECT data FROM company_settings WHERE company_id=?").get(companyId);
    this.db.prepare("INSERT INTO company_settings (company_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(company_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").run(companyId, JSON.stringify(settings), now());
    if (audit) this.audit(existing ? "updated" : "created", "settings", "singleton", existing ? JSON.parse(existing.data) : null, settings);
  }

  saveFinancing(financing) {
    const companyId = this.requireActiveCompany();
    const client = this.getById("clients", financing.clientId);
    const budget = this.getById("budgets", financing.budgetId);
    const work = financing.workId ? this.getById("works", financing.workId) : null;
    if (!client || !budget || (financing.workId && !work)) throw new Error("Cliente, obra ou orçamento não pertence à empresa ativa.");
    if (budget.clientId !== client.id || (work && work.clientId !== client.id)) throw new Error("A origem selecionada não pertence ao cliente informado.");
    const workIds = [...new Set((Array.isArray(financing.workIds) ? financing.workIds : financing.workId ? [financing.workId] : []).filter(Boolean))];
    const budgetIds = [...new Set((Array.isArray(financing.budgetIds) ? financing.budgetIds : [financing.budgetId]).filter(Boolean))];
    if (!budgetIds.length) throw new Error("Selecione pelo menos um orçamento para o financiamento.");
    for (const workId of workIds) { const sourceWork = this.getById("works", workId); if (!sourceWork || sourceWork.clientId !== client.id) throw new Error("Uma das obras selecionadas não pertence ao cliente informado."); }
    for (const budgetId of budgetIds) { const sourceBudget = this.getById("budgets", budgetId); if (!sourceBudget || sourceBudget.clientId !== client.id) throw new Error("Um dos orçamentos selecionados não pertence ao cliente informado."); }
    const count = Math.trunc(Number(financing.installmentsCount));
    if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error("Informe entre 1 e 120 parcelas.");
    if (!financing.firstPaymentDate || !Array.isArray(financing.installments) || financing.installments.length !== count) throw new Error("A tabela de parcelas está incompleta.");
    const principalAmount = Number(financing.principalAmount);
    const downPaymentAmount = Number(financing.downPaymentAmount || 0);
    const financedAmount = Number(financing.financedAmount ?? (principalAmount - downPaymentAmount));
    if (!Number.isFinite(principalAmount) || principalAmount <= 0 || !Number.isFinite(Number(financing.totalFinanced)) || Number(financing.totalFinanced) <= 0) throw new Error("Os valores do financiamento são inválidos.");
    if (!Number.isFinite(downPaymentAmount) || downPaymentAmount < 0 || downPaymentAmount >= principalAmount) throw new Error("O valor da entrada deve ser maior ou igual a zero e menor que o valor total da obra.");
    if (!Number.isFinite(financedAmount) || Math.abs(financedAmount - (principalAmount - downPaymentAmount)) > 0.01) throw new Error("O saldo parcelado não corresponde ao valor da obra menos a entrada.");
    const installmentsTotal = financing.installments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
    if (!Number.isFinite(installmentsTotal) || Math.abs(installmentsTotal - Number(financing.totalFinanced)) > 0.01) throw new Error("O total das parcelas não corresponde ao total financiado.");
    const existingRow = this.db.prepare("SELECT data,company_id FROM financings WHERE id=?").get(financing.id);
    if (existingRow && existingRow.company_id !== companyId) throw new Error("Acesso negado: o financiamento pertence a outra empresa.");
    const timestamp = now(); const existing = existingRow ? JSON.parse(existingRow.data) : null;
    const stored = { ...financing, workId: financing.workId || "", budgetId: financing.budgetId || budgetIds[0], workIds, budgetIds, companyId, createdAt: existing?.createdAt || financing.createdAt || timestamp, updatedAt: timestamp };
    this.db.prepare("INSERT INTO financings (id,client_id,work_id,budget_id,first_payment_date,installments_count,total_financed,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,work_id=excluded.work_id,budget_id=excluded.budget_id,first_payment_date=excluded.first_payment_date,installments_count=excluded.installments_count,total_financed=excluded.total_financed,data=excluded.data,updated_at=excluded.updated_at").run(stored.id, stored.clientId, stored.workId || null, stored.budgetId, stored.firstPaymentDate, count, Number(stored.totalFinanced), JSON.stringify(stored), stored.createdAt, timestamp, companyId);
    this.audit(existing ? "updated" : "created", "financing", stored.id, existing, stored, { budgetId: stored.budgetId, workId: stored.workId });
    return stored;
  }

  deleteFinancing(financingId) {
    const companyId = this.requireActiveCompany();
    const row = this.db.prepare("SELECT data, company_id FROM financings WHERE id=?").get(financingId);
    if (!row) throw new Error("Financiamento não encontrado.");
    if (row.company_id !== companyId) throw new Error("Acesso negado: o financiamento pertence a outra empresa.");
    const existing = JSON.parse(row.data);
    this.db.prepare("DELETE FROM financings WHERE id=? AND company_id=?").run(financingId, companyId);
    this.audit("deleted", "financing", financingId, existing, null, { budgetId: existing.budgetId, workId: existing.workId });
    return true;
  }

  saveFiscalSettings(settings) {
    const companyId = this.requireActiveCompany();
    const existing = this.db.prepare("SELECT data FROM company_fiscal_settings WHERE company_id=?").get(companyId);
    const stored = { ...settings, id: "singleton", companyId, updatedAt: now() };
    this.db.prepare("INSERT INTO company_fiscal_settings (company_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(company_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").run(companyId, JSON.stringify(stored), stored.updatedAt);
    this.audit(existing ? "updated" : "created", "fiscal_settings", "singleton", existing ? JSON.parse(existing.data) : null, stored, { phase: "nfse-foundation", transmission: "disabled" });
    return stored;
  }

  confirmServiceCompletion(completion) {
    const budget = this.getById("budgets", completion.budgetId);
    if (!budget) throw new Error("O orçamento não foi encontrado.");
    if (budget.status !== "Aprovado") throw new Error("A confirmação só pode ser feita para orçamento aprovado.");
    const work = completion.workId ? this.getById("works", completion.workId) : null;
    const order = completion.orderId ? this.getById("orders", completion.orderId) : null;
    if (!work && !order) throw new Error("Vincule a confirmação a uma obra ou ordem de serviço.");
    if (work && (work.budgetId !== budget.id || work.clientId !== budget.clientId)) throw new Error("A obra não pertence a este orçamento.");
    if (order && (order.clientId !== budget.clientId || (budget.sourceOrderId && order.id !== budget.sourceOrderId))) throw new Error("A ordem não pertence a este orçamento.");
    const timestamp = now();
    const companyId = this.requireActiveCompany();
    const existing = this.db.prepare("SELECT data FROM service_completions WHERE budget_id=? AND company_id=?").get(completion.budgetId, companyId);
    const stored = { ...completion, companyId, id: existing ? JSON.parse(existing.data).id : (completion.id || crypto.randomUUID()), completedOn: completion.completedOn, confirmedBy: completion.confirmedBy.trim(), notes: completion.notes?.trim() || "", createdAt: existing ? JSON.parse(existing.data).createdAt : (completion.createdAt || timestamp), updatedAt: timestamp };
    if (!stored.completedOn || !stored.confirmedBy) throw new Error("Informe a data e o responsável pela confirmação.");
    this.db.prepare("INSERT INTO service_completions (id,budget_id,work_id,order_id,completed_on,confirmed_by,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(budget_id) DO UPDATE SET work_id=excluded.work_id,order_id=excluded.order_id,completed_on=excluded.completed_on,confirmed_by=excluded.confirmed_by,data=excluded.data,updated_at=excluded.updated_at").run(stored.id, stored.budgetId, stored.workId || null, stored.orderId || null, stored.completedOn, stored.confirmedBy, JSON.stringify(stored), stored.createdAt, timestamp, companyId);
    this.audit(existing ? "updated" : "created", "service_completion", stored.id, existing ? JSON.parse(existing.data) : null, stored, { actor: stored.confirmedBy });
    return stored;
  }

  saveNfseDraft(budgetId, input) {
    const companyId = this.requireActiveCompany(); const budget = this.getById("budgets", budgetId);
    if (!budget) throw new Error("Orçamento não encontrado na empresa ativa.");
    if (budget.status !== "Aprovado") throw new Error("A nota fiscal só pode ser preparada a partir de orçamento aprovado.");
    const completion = this.db.prepare("SELECT data FROM service_completions WHERE budget_id=? AND company_id=?").get(budgetId, companyId);
    if (!completion) throw new Error("Confirme explicitamente a prestação do serviço antes de criar o rascunho fiscal.");
    const client = this.getById("clients", budget.clientId); const timestamp = now();
    const existing = this.db.prepare("SELECT data FROM nfse_drafts WHERE budget_id=? AND company_id=?").get(budgetId, companyId);
    const previous = existing ? JSON.parse(existing.data) : null;
    const stored = { id: previous?.id || crypto.randomUUID(), companyId, budgetId, clientId: client.id, status: "Rascunho", title: String(input.title || "").trim(), serviceDescription: String(input.serviceDescription || "").trim(), paymentDescription: String(input.paymentDescription || "").trim(), serviceValue: Number(input.serviceValue ?? budget.totalValue) || 0, discounts: Number(input.discounts || 0), clientSnapshot: JSON.parse(JSON.stringify(client)), budgetSnapshot: JSON.parse(JSON.stringify(budget)), completionSnapshot: JSON.parse(completion.data), createdAt: previous?.createdAt || timestamp, updatedAt: timestamp };
    this.db.prepare("INSERT INTO nfse_drafts (id,budget_id,client_id,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(company_id,budget_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").run(stored.id, budgetId, client.id, JSON.stringify(stored), stored.createdAt, timestamp, companyId);
    this.audit(previous ? "updated" : "created", "nfse_draft", stored.id, previous, stored);
    return stored;
  }

  prepareNfse(budgetId) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const companyId = this.requireActiveCompany();
      const existing = this.db.prepare("SELECT data FROM nfse_records WHERE budget_id=? AND company_id=?").get(budgetId, companyId);
      if (existing) throw new Error("Já existe uma NFS-e em preparação ou registrada para este orçamento. Consulte o registro anterior antes de continuar.");
      const budget = this.getById("budgets", budgetId);
      if (!budget) throw new Error("O orçamento não foi encontrado.");
      if (budget.status !== "Aprovado") throw new Error("A preparação fiscal exige um orçamento aprovado.");
      const completionRow = this.db.prepare("SELECT data FROM service_completions WHERE budget_id=? AND company_id=?").get(budgetId, companyId);
      if (!completionRow) throw new Error("Confirme explicitamente a prestação do serviço antes de preparar a NFS-e.");
      const settingsRow = this.db.prepare("SELECT data FROM company_fiscal_settings WHERE company_id=?").get(companyId);
      if (!settingsRow) throw new Error("Configurações fiscais pendentes.");
      const settings = JSON.parse(settingsRow.data);
      const missing = [
        [settings.legalName, "Razão social"], [settings.cnpj, "CNPJ"], [settings.municipalRegistration, "Inscrição municipal"], [settings.taxRegime, "Regime tributário"], [settings.municipalityIbgeCode, "Código IBGE do município"], [settings.defaultServiceCode, "Código de serviço"], [settings.defaultServiceDescription, "Descrição do serviço"], [settings.dpsSeries, "Série DPS"]
      ].filter(([value]) => !String(value || "").trim()).map(([, label]) => label);
      if (settings.issRate === null || settings.issRate === undefined) missing.push("Alíquota de ISS");
      if (!settings.retentions?.confirmed) missing.push("Confirmação das retenções");
      if (missing.length) throw new Error("Configuração fiscal pendente: " + missing.join(", ") + ".");
      const client = this.getById("clients", budget.clientId);
      if (!client?.document?.trim() || !client?.address?.trim()) throw new Error("O tomador precisa ter CPF/CNPJ e endereço cadastrados.");
      const draftRow = this.db.prepare("SELECT data FROM nfse_drafts WHERE budget_id=? AND company_id=?").get(budgetId, companyId);
      if (!draftRow) throw new Error("Salve e revise o rascunho fiscal antes de preparar a DPS.");
      const draft = JSON.parse(draftRow.data);
      if (!draft.title || !draft.serviceDescription) throw new Error("Título e descrição detalhada do serviço são obrigatórios no rascunho fiscal.");
      const completion = JSON.parse(completionRow.data);
      const issuer = String(settings.cnpj).replace(/\D/g, "");
      const sequence = this.db.prepare("SELECT next_number FROM dps_sequences WHERE issuer_cnpj=? AND series=? AND company_id=?").get(issuer, settings.dpsSeries, companyId);
      const dpsNumber = sequence?.next_number || 1;
      const timestamp = now();
      this.db.prepare("INSERT INTO dps_sequences (issuer_cnpj,series,next_number,updated_at,company_id) VALUES (?,?,?,?,?) ON CONFLICT(company_id,issuer_cnpj,series) DO UPDATE SET next_number=excluded.next_number,updated_at=excluded.updated_at").run(issuer, settings.dpsSeries, dpsNumber + 1, timestamp, companyId);
      const fiscalSnapshot = JSON.parse(JSON.stringify(settings));
      const record = { id: crypto.randomUUID(), companyId, budgetId: budget.id, clientId: client.id, workId: completion.workId || undefined, orderId: completion.orderId || undefined, status: "DPS preparada", dpsSeries: settings.dpsSeries, dpsNumber, competencyDate: completion.completedOn, serviceTitle: draft.title, serviceCode: settings.defaultServiceCode, serviceDescription: draft.serviceDescription, paymentDescription: draft.paymentDescription, discounts: draft.discounts, municipalityName: settings.municipalityName, municipalityIbgeCode: settings.municipalityIbgeCode, serviceValue: draft.serviceValue, issRate: settings.issRate, fiscalSnapshot, clientSnapshot: draft.clientSnapshot, budgetSnapshot: draft.budgetSnapshot, draftSnapshot: JSON.parse(JSON.stringify(draft)), createdAt: timestamp, updatedAt: timestamp };
      this.db.prepare("INSERT INTO nfse_records (id,budget_id,client_id,work_id,order_id,status,dps_series,dps_number,data,created_at,updated_at,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(record.id, record.budgetId, record.clientId, record.workId || null, record.orderId || null, record.status, record.dpsSeries, record.dpsNumber, JSON.stringify(record), timestamp, timestamp, companyId);
      const attempt = { id: crypto.randomUUID(), nfseId: record.id, status: record.status, operation: "preparação", requestSummary: "DPS reservada para conferência interna. Transmissão desabilitada na Fase 2.", responseSummary: "Sem comunicação externa.", createdAt: timestamp };
      this.db.prepare("INSERT INTO nfse_transmission_attempts (id,nfse_id,status,operation,data,created_at,company_id) VALUES (?,?,?,?,?,?,?)").run(attempt.id, record.id, attempt.status, attempt.operation, JSON.stringify({ ...attempt, companyId }), timestamp, companyId);
      this.audit("prepared", "nfse_record", record.id, null, record, { completionId: completion.id, transmission: "disabled", dpsNumber });
      this.audit("created", "nfse_transmission_attempt", attempt.id, null, attempt, { transmission: "disabled" });
      this.db.exec("COMMIT");
      return { record, attempt };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  registerCertificateReference(reference) {
    const companyId = this.requireActiveCompany();
    const keychainReference = String(reference.keychainReference || "").trim();
    if (!keychainReference) throw new Error("A referência segura do certificado é obrigatória.");
    const fiscal = this.db.prepare("SELECT data FROM company_fiscal_settings WHERE company_id=?").get(companyId)?.data;
    const issuerCnpj = fiscal ? String(JSON.parse(fiscal).cnpj || "").replace(/\D/g, "") : "";
    const certificateCnpj = String(reference.certificateCnpj || "").replace(/\D/g, "");
    if (issuerCnpj && certificateCnpj && issuerCnpj !== certificateCnpj) throw new Error("O CNPJ do certificado não pertence à empresa ativa.");
    const timestamp = now(); const stored = { id: reference.id || crypto.randomUUID(), companyId, certificateType: reference.certificateType || "A1", keychainReference, certificateCnpj: certificateCnpj || null, fingerprint: reference.fingerprint || null, validUntil: reference.validUntil || null, createdAt: timestamp, updatedAt: timestamp };
    this.db.prepare("INSERT INTO company_certificate_references (id,company_id,certificate_type,keychain_reference,certificate_cnpj,fingerprint,valid_until,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(stored.id, companyId, stored.certificateType, stored.keychainReference, stored.certificateCnpj, stored.fingerprint, stored.validUntil, JSON.stringify(stored), timestamp, timestamp);
    this.audit("registered", "certificate_reference", stored.id, null, { ...stored, keychainReference: "[segredo não exposto]" });
    return { ...stored, keychainReference: "[armazenado no cofre do sistema]" };
  }

  recordNfseAttempt(attempt) {
    const companyId = this.requireActiveCompany();
    const record = this.db.prepare("SELECT id FROM nfse_records WHERE id=? AND company_id=?").get(attempt.nfseId, companyId);
    if (!record) throw new Error("Registro fiscal não encontrado na empresa ativa.");
    const stored = { id: attempt.id || crypto.randomUUID(), companyId, nfseId: attempt.nfseId, status: attempt.status, operation: attempt.operation, requestSummary: String(attempt.requestSummary || "").slice(0, 2000), responseSummary: String(attempt.responseSummary || "").slice(0, 4000), correlationId: attempt.correlationId || null, createdAt: now() };
    this.db.prepare("INSERT INTO nfse_transmission_attempts (id,nfse_id,status,operation,data,created_at,company_id) VALUES (?,?,?,?,?,?,?)").run(stored.id, stored.nfseId, stored.status, stored.operation, JSON.stringify(stored), stored.createdAt, companyId);
    this.audit("created", "nfse_transmission_attempt", stored.id, null, stored, { correlationId: stored.correlationId });
    return stored;
  }

  storeNfseArtifact({ nfseId, artifactType, contents, storagePath = null }) {
    const companyId = this.requireActiveCompany();
    if (!this.db.prepare("SELECT id FROM nfse_records WHERE id=? AND company_id=?").get(nfseId, companyId)) throw new Error("Registro fiscal não encontrado na empresa ativa.");
    const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(String(contents || ""), "utf8");
    if (!buffer.length) throw new Error("Artefato fiscal vazio.");
    const sha256 = checksum(buffer); const stored = { id: crypto.randomUUID(), companyId, nfseId, artifactType, sha256, storagePath, createdAt: now() };
    this.db.prepare("INSERT OR IGNORE INTO nfse_artifacts (id,nfse_id,artifact_type,sha256,storage_path,data,created_at,company_id) VALUES (?,?,?,?,?,?,?,?)").run(stored.id, nfseId, artifactType, sha256, storagePath, JSON.stringify(stored), stored.createdAt, companyId);
    this.audit("stored", "nfse_artifact", stored.id, null, stored);
    return stored;
  }

  snapshot() {
    const companyId = this.activeCompanyId();
    const rows = (table) => companyId ? this.db.prepare("SELECT data FROM " + table + " WHERE company_id=?").all(companyId).map((row) => JSON.parse(row.data)) : [];
    const setting = (table) => companyId ? this.db.prepare("SELECT data FROM " + table + " WHERE company_id=?").get(companyId)?.data : null;
    return { activeCompany: this.activeCompany(), companies: this.listCompanies(), clients: rows("clients").sort((a,b) => a.name.localeCompare(b.name)), budgets: rows("budgets").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), financialSheets: rows("financial_sheets"), orders: rows("orders"), clientFiles: rows("client_files").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), works: rows("works").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), financings: rows("financings").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), ledgerEntries: rows("ledger_entries").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), professionals: rows("professionals").sort((a,b) => a.name.localeCompare(b.name)), workDays: rows("work_days").sort((a,b) => b.date.localeCompare(a.date)), suppliers: rows("suppliers").sort((a,b) => b.name.localeCompare(a.name)), purchases: rows("purchases").sort((a,b) => b.date.localeCompare(a.date)), products: rows("products").sort((a,b) => a.name.localeCompare(b.name)), tools: rows("tools").sort((a,b) => a.name.localeCompare(b.name)), documents: rows("documents").sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), serviceCompletions: rows("service_completions"), nfseDrafts: rows("nfse_drafts"), nfseRecords: rows("nfse_records").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), nfseAttempts: rows("nfse_transmission_attempts").sort((a,b) => b.createdAt.localeCompare(a.createdAt)), certificateReferences: rows("company_certificate_references").map((reference) => ({ ...reference, keychainReference: "[armazenado no cofre do sistema]" })), fiscalSettings: setting("company_fiscal_settings") ? JSON.parse(setting("company_fiscal_settings")) : null, settings: setting("company_settings") ? JSON.parse(setting("company_settings")) : null };
  }

  async backup(payload) {
    const directory = path.join(this.root, "backups");
    await fs.mkdir(directory, { recursive: true });
    const serialized = JSON.stringify(payload, null, 2);
    const manifest = { createdAt: now(), checksum: checksum(serialized), counts: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0])) };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(directory, "localstorage-before-sqlite-" + stamp + ".json");
    await fs.writeFile(backupPath, serialized, "utf8");
    await fs.writeFile(backupPath + ".manifest.json", JSON.stringify(manifest, null, 2), "utf8");
    const verified = checksum(await fs.readFile(backupPath, "utf8")) === manifest.checksum;
    if (!verified) throw new Error("Falha na verificação do backup.");
    return { backupPath, manifest, verified };
  }

  migrateLegacy(payload) {
    if (this.getMeta("legacy_localstorage_migration_v1") === "done") return { migrated: false, snapshot: this.snapshot() };
    this.db.exec("BEGIN");
    try {
      if (!this.activeCompanyId()) this.createCompany({ legalName: payload.settings?.companyName || "Empresa importada", tradeName: payload.settings?.companyName || "Empresa importada" });
      (payload.clients || []).forEach((record) => this.save("clients", { ...record, active: record.active !== false }, record.id?.startsWith("dolibarr-client-") ? "dolibarr" : null, record.id?.replace("dolibarr-client-", "") || null, false));
      const legacySettings = payload.settings || {};
      (payload.budgets || []).forEach((record) => this.save("budgets", { ...record, pricingSnapshot: record.pricingSnapshot || { icmsRate: Number(legacySettings.icmsRate) || 0, stateRate: Number(legacySettings.stateRate) || 0, federalRate: Number(legacySettings.federalRate) || 0, companyProfitRate: Number(legacySettings.companyProfitRate) || 0, capturedAt: record.createdAt || now() } }, record.id?.startsWith("dolibarr-budget-") ? "dolibarr" : null, record.id?.replace("dolibarr-budget-", "") || null, false));
      (payload.financialSheets || []).forEach((record) => this.save("financial_sheets", record, null, null, false));
      (payload.orders || []).forEach((record) => this.save("orders", record, null, null, false));
      (payload.clientFiles || []).forEach((record) => this.save("client_files", record, record.id?.startsWith("dolibarr-file-") ? "dolibarr" : null, record.id?.replace("dolibarr-file-", "") || null, false));
      if (payload.settings) this.saveSettings(payload.settings, false);
      this.setMeta("legacy_localstorage_migration_v1", "done");
      this.audit("migration_completed", "system", "legacy_localstorage_v1", null, null, { counts: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0])) });
      this.db.exec("COMMIT");
      return { migrated: true, snapshot: this.snapshot() };
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}

module.exports = { NexusStore };

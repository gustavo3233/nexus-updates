const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { NexusStore } = require("./database/store.cjs");
const { createHomologationDiagnostics } = require("./fiscal/nfse-diagnostics.cjs");
// A versão empacotada de teste mantém sua própria pasta de dados, sem tocar no banco do desenvolvimento.
if (app.isPackaged) app.setName("Nexus Teste");
const execFileAsync = promisify(execFile);
let store;

function safePathSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function dolibarrQuery(sql) {
  const config = await fs.readFile("/var/www/html/dolibarr/htdocs/conf/conf.php", "utf8");
  const get = (name) => (config.match(new RegExp("\\$" + name + "='([^']*)'")) || [])[1];
  const environment = { ...process.env, MYSQL_PWD: get("dolibarr_main_db_pass") };
  const args = ["--protocol=socket", "-u" + get("dolibarr_main_db_user"), "-N", "-B", "-e", "USE " + get("dolibarr_main_db_name") + "; " + sql];
  const { stdout } = await execFileAsync("mariadb", args, { env: environment });
  return JSON.parse(stdout.trim() || "[]");
}

function categoryForFile(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("nota") || lower.includes("nfe") || lower.includes("nf-")) return "nota_fiscal";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "planilha";
  return "documento";
}

async function importDolibarr() {
  const clients = await dolibarrQuery("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('sourceId',rowid,'name',nom,'address',CONCAT_WS(', ',address,zip,town),'phone',COALESCE(phone,phone_mobile,''),'email',email,'document',COALESCE(NULLIF(siret,''),NULLIF(siren,''),NULLIF(tva_intra,''),''),'createdAt',DATE_FORMAT(datec,'%Y-%m-%dT%H:%i:%s.000Z'))),JSON_ARRAY()) FROM llx_societe WHERE client IN (1,2,3) OR client IS NULL");
  const budgets = await dolibarrQuery("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('sourceId',p.rowid,'clientSourceId',p.fk_soc,'title',p.ref,'description',COALESCE(p.note_public,''),'issueDate',DATE_FORMAT(COALESCE(p.datep,p.datec),'%Y-%m-%d'),'validUntil',DATE_FORMAT(p.fin_validite,'%Y-%m-%d'),'status',p.fk_statut,'total',p.total_ht,'createdAt',DATE_FORMAT(p.datec,'%Y-%m-%dT%H:%i:%s.000Z'),'items',(SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',d.rowid,'description',COALESCE(NULLIF(d.label,''),d.description,''),'quantity',d.qty,'unitPrice',d.subprice,'icmsRate',d.tva_tx,'issRate',0)),JSON_ARRAY()) FROM llx_propaldet d WHERE d.fk_propal=p.rowid))),JSON_ARRAY()) FROM llx_propal p");
  const files = await dolibarrQuery("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('sourceId',f.rowid,'type',f.src_object_type,'objectId',f.src_object_id,'filepath',f.filepath,'filename',f.filename,'createdAt',DATE_FORMAT(f.date_c,'%Y-%m-%dT%H:%i:%s.000Z'),'clientSourceId',CASE WHEN f.src_object_type='societe' THEN f.src_object_id WHEN f.src_object_type='propal' THEN p.fk_soc ELSE NULL END)),JSON_ARRAY()) FROM llx_ecm_files f LEFT JOIN llx_propal p ON f.src_object_type='propal' AND p.rowid=f.src_object_id WHERE f.src_object_type IN ('societe','propal')");
  const destinationRoot = path.join(app.getPath("userData"), "client-files");
  const copied = [];
  for (const file of files) {
    if (!file.clientSourceId || !file.filename || !file.filepath) continue;
    const sourcePath = path.join("/var/lib/dolibarr/documents", file.filepath, file.filename);
    const destinationDirectory = path.join(destinationRoot, "dolibarr-client-" + file.clientSourceId);
    const destinationPath = path.join(destinationDirectory, "dolibarr-file-" + file.sourceId + "-" + safePathSegment(file.filename));
    try { await fs.mkdir(destinationDirectory, { recursive: true }); await fs.copyFile(sourcePath, destinationPath); copied.push({ ...file, localPath: destinationPath, category: categoryForFile(file.filename) }); } catch { /* Ignore missing metadata/cache files. */ }
  }
  return { clients, budgets, files: copied };
}

async function syncDolibarrToStore() {
  const companyId = store.requireActiveCompany();
  const source = await importDolibarr();
  const configuredRates = store.snapshot().settings || {};
  const companyName = store.snapshot().settings?.companyName || store.activeCompany()?.tradeName || store.activeCompany()?.legalName || "";
  const clients = source.clients.map((item) => ({ id: "dolibarr-client-" + item.sourceId, name: item.name, type: item.document ? "PJ" : "PF", document: item.document || "", phone: item.phone || "", email: item.email || "", address: item.address || "", notes: "Importado do Dolibarr", active: true, createdAt: item.createdAt || new Date().toISOString() }));
  const budgets = source.budgets.map((item) => ({ id: "dolibarr-budget-" + item.sourceId, clientId: "dolibarr-client-" + item.clientSourceId, title: item.title || "Orçamento Dolibarr", description: item.description || "", workAddress: "", companyName, companyDocument: "", companyCity: "", items: item.items.map((line) => ({ id: "dolibarr-item-" + line.id, description: line.description || "Item", quantity: Number(line.quantity) || 1, unit: "un", unitPrice: Number(line.unitPrice) || 0, icmsRate: Number(line.icmsRate) || 0, issRate: 0 })), estimatedExpenses: [], paymentMethod: "", executionPeriod: "", totalValue: Number(item.total) || 0, issueDate: item.issueDate || item.createdAt.slice(0, 10), validUntil: item.validUntil || "", observations: "Importado do Dolibarr", status: item.status === 4 ? "Faturado" : item.status === 2 ? "Aprovado" : (item.status === 3 || item.status === -1) ? "Não aprovado" : item.status === 1 ? "Enviado" : "Rascunho", pricingSnapshot: { icmsRate: Number(configuredRates.icmsRate) || 0, stateRate: Number(configuredRates.stateRate) || 0, federalRate: Number(configuredRates.federalRate) || 0, companyProfitRate: Number(configuredRates.companyProfitRate) || 0, capturedAt: item.createdAt || new Date().toISOString() }, createdAt: item.createdAt || new Date().toISOString() }));
  const files = source.files.map((item) => ({ id: "dolibarr-file-" + item.sourceId, clientId: "dolibarr-client-" + item.clientSourceId, category: item.category, name: item.filename, localPath: item.localPath, createdAt: item.createdAt || new Date().toISOString() }));
  const runId = crypto.randomUUID();
  const importSource = "dolibarr:" + companyId;
  store.db.prepare("INSERT INTO import_runs (id,source,started_at,status,company_id) VALUES (?,?,?,?,?)").run(runId, importSource, new Date().toISOString(), "running", companyId);
  try {
    clients.forEach((record) => store.save("clients", record, importSource, record.id.replace("dolibarr-client-", ""), false));
    budgets.forEach((record) => store.save("budgets", record, importSource, record.id.replace("dolibarr-budget-", ""), false));
    files.forEach((record) => store.save("client_files", record, importSource, record.id.replace("dolibarr-file-", ""), false));
    const summary = { clients: clients.length, budgets: budgets.length, files: files.length };
    store.db.prepare("UPDATE import_runs SET completed_at=?,status=?,summary=? WHERE id=? AND company_id=?").run(new Date().toISOString(), "completed", JSON.stringify(summary), runId, companyId);
    store.audit("synchronized", "dolibarr", runId, null, null, summary);
    return { ...source, summary };
  } catch (error) {
    store.db.prepare("UPDATE import_runs SET completed_at=?,status=?,error=? WHERE id=? AND company_id=?").run(new Date().toISOString(), "failed", String(error.message || error), runId, companyId);
    throw error;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    backgroundColor: "#F8FAFC",
    title: "Nexus Construção e Reformas",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  if (process.env.NEXUS_DEV_SERVER_URL) {
    window.loadURL(process.env.NEXUS_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  window.once("ready-to-show", () => { window.show(); window.focus(); });

  window.webContents.on("did-finish-load", async () => {
    try {
      if (store.getMeta("legacy_localstorage_migration_v1") !== "done") {
        const legacy = await window.webContents.executeJavaScript(`(() => ({
          clients: JSON.parse(localStorage.getItem('@nexus/desktop/clients') || '[]'),
          budgets: JSON.parse(localStorage.getItem('@nexus/desktop/budgets') || '[]'),
          financialSheets: JSON.parse(localStorage.getItem('@nexus/desktop/financial-sheets') || '[]'),
          orders: JSON.parse(localStorage.getItem('@nexus/desktop/orders') || '[]'),
          clientFiles: JSON.parse(localStorage.getItem('@nexus/desktop/client-files') || '[]'),
          settings: JSON.parse(localStorage.getItem('@nexus/desktop/settings') || 'null')
        }))()`);
        const backup = await store.backup(legacy);
        store.setMeta("legacy_localstorage_backup_v1", JSON.stringify({ path: backup.backupPath, manifest: backup.manifest }));
        const migration = store.migrateLegacy(legacy);
        const originalCounts = Object.fromEntries(Object.entries(legacy).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0]));
        const migratedCounts = { clients: migration.snapshot.clients.length, budgets: migration.snapshot.budgets.length, financialSheets: migration.snapshot.financialSheets.length, orders: migration.snapshot.orders.length, clientFiles: migration.snapshot.clientFiles.length, settings: migration.snapshot.settings ? 1 : 0 };
        if (JSON.stringify(originalCounts) !== JSON.stringify(migratedCounts)) throw new Error("Migração interrompida: a contagem dos dados não corresponde ao backup.");
        console.log("SQLite migration complete and verified:", migratedCounts);
        window.webContents.reload();
        return;
      }
      if (store.getMeta("dolibarr_sqlite_sync_v2") !== "done") {
        const result = await syncDolibarrToStore();
        store.setMeta("dolibarr_sqlite_sync_v2", "done");
        console.log("Dolibarr SQLite sync complete:", result.summary);
        window.webContents.reload();
        return;
      }
      const alreadyImported = await window.webContents.executeJavaScript("localStorage.getItem('@nexus/dolibarr-imported-v3') === 'done'");
      if (alreadyImported) return;
      const source = await importDolibarr();
      const clients = source.clients.map((item) => ({ id: "dolibarr-client-" + item.sourceId, name: item.name, type: item.document ? "PJ" : "PF", document: item.document || "", phone: item.phone || "", email: item.email || "", address: item.address || "", notes: "Importado do Dolibarr", createdAt: item.createdAt || new Date().toISOString() }));
      const budgets = source.budgets.map((item) => ({ id: "dolibarr-budget-" + item.sourceId, clientId: "dolibarr-client-" + item.clientSourceId, title: item.title || "Orçamento Dolibarr", description: item.description || "", workAddress: "", companyName: "Nexus Construção e Reformas", companyDocument: "", companyCity: "", items: item.items.map((line) => ({ id: "dolibarr-item-" + line.id, description: line.description || "Item", quantity: Number(line.quantity) || 1, unit: "un", unitPrice: Number(line.unitPrice) || 0, icmsRate: Number(line.icmsRate) || 0, issRate: 0 })), estimatedExpenses: [], paymentMethod: "", executionPeriod: "", totalValue: Number(item.total) || 0, issueDate: item.issueDate || item.createdAt.slice(0, 10), validUntil: item.validUntil || "", observations: "Importado do Dolibarr", status: item.status === 4 ? "Faturado" : item.status === 2 ? "Aprovado" : (item.status === 3 || item.status === -1) ? "Não aprovado" : item.status === 1 ? "Enviado" : "Rascunho", createdAt: item.createdAt || new Date().toISOString() }));
      const files = source.files.map((item) => ({ id: "dolibarr-file-" + item.sourceId, clientId: "dolibarr-client-" + item.clientSourceId, category: item.category, name: item.filename, localPath: item.localPath, createdAt: item.createdAt || new Date().toISOString() }));
      const script = `(() => { const source = ${JSON.stringify({ clients, budgets, files })}; const merge = (key, values, prefix) => { const old = JSON.parse(localStorage.getItem(key) || '[]'); localStorage.setItem(key, JSON.stringify([...old.filter((item) => !String(item.id).startsWith(prefix)), ...values])); }; merge('@nexus/desktop/clients', source.clients, 'dolibarr-client-'); merge('@nexus/desktop/budgets', source.budgets, 'dolibarr-budget-'); merge('@nexus/desktop/client-files', source.files, 'dolibarr-file-'); localStorage.setItem('@nexus/dolibarr-imported-v3', 'done'); })()`;
      await window.webContents.executeJavaScript(script);
      console.log(`Dolibarr import complete: ${clients.length} clients, ${budgets.length} budgets, ${files.length} files`);
      window.webContents.reload();
    } catch (error) { console.error("Automatic Dolibarr import failed:", error); }
  });
}

app.whenReady().then(() => {
  store = new NexusStore(app.getPath("userData"));
  store.open();
  ipcMain.handle("nexus:database-snapshot", () => store.snapshot());
  ipcMain.handle("nexus:companies-list", () => store.listCompanies());
  ipcMain.handle("nexus:companies-create", (_event, company) => store.createCompany(company));
  ipcMain.handle("nexus:companies-select", (_event, companyId) => { store.setActiveCompany(companyId); return store.snapshot(); });
  ipcMain.handle("nexus:database-save", (_event, entity, record) => store.save(entity, record));
  ipcMain.handle("nexus:database-save-financing", (_event, financing) => store.saveFinancing(financing));
  ipcMain.handle("nexus:database-delete-financing", (_event, financingId) => store.deleteFinancing(financingId));
  ipcMain.handle("nexus:database-delete-budget", (_event, budgetId) => store.deleteBudget(budgetId));
  ipcMain.handle("nexus:database-save-work-day", (_event, day) => store.saveWorkDayAndExpense(day));
  ipcMain.handle("nexus:database-save-purchase", (_event, purchase) => store.savePurchaseAndExpense(purchase));
  ipcMain.handle("nexus:database-save-settings", (_event, settings) => { store.saveSettings(settings); return settings; });
  ipcMain.handle("nexus:fiscal-save-settings", (_event, settings) => store.saveFiscalSettings(settings));
  ipcMain.handle("nexus:fiscal-save-draft", (_event, budgetId, draft) => store.saveNfseDraft(budgetId, draft));
  ipcMain.handle("nexus:fiscal-import-a1", async (_event, details) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("O cofre seguro do sistema operacional não está disponível. O certificado não será importado.");
    const result = await dialog.showOpenDialog({ title: "Selecionar certificado A1", properties: ["openFile"], filters: [{ name: "Certificado A1", extensions: ["pfx", "p12"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const contents = await fs.readFile(result.filePaths[0]);
    if (!contents.length) throw new Error("O arquivo de certificado está vazio.");
    const companyId = store.requireActiveCompany(); const fingerprint = crypto.createHash("sha256").update(contents).digest("hex");
    const directory = path.join(app.getPath("userData"), "nfse", "certificates", safePathSegment(companyId)); await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const keychainReference = path.join(directory, fingerprint + ".pfx.enc");
    const encrypted = safeStorage.encryptString(contents.toString("base64"));
    await fs.writeFile(keychainReference, encrypted, { mode: 0o600 });
    const saved = store.registerCertificateReference({ certificateType: "A1", keychainReference, certificateCnpj: String(details?.certificateCnpj || ""), fingerprint, validUntil: details?.validUntil || null });
    return saved;
  });
  ipcMain.handle("nexus:fiscal-confirm-service", (_event, completion) => store.confirmServiceCompletion(completion));
  ipcMain.handle("nexus:fiscal-prepare-nfse", (_event, budgetId) => store.prepareNfse(budgetId));
  ipcMain.handle("nexus:fiscal-homologation-diagnostics", () => {
    const snapshot = store.snapshot();
    const xsdRoot = path.join(app.getPath("userData"), "nfse", "xsd", "NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20261020");
    return createHomologationDiagnostics({ fiscalSettings: snapshot.fiscalSettings, certificateReferences: snapshot.certificateReferences, xsdPackagePath: path.join(xsdRoot, "package.zip") });
  });
  ipcMain.handle("nexus:database-status", () => ({ databasePath: store.dbPath, legacyMigration: store.getMeta("legacy_localstorage_migration_v1"), backup: store.getMeta("legacy_localstorage_backup_v1") }));
  ipcMain.handle("nexus:open-whatsapp-web", async (_event, phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    if (normalized.length < 10 || normalized.length > 15) throw new Error("Informe um telefone válido, com DDD, para abrir o WhatsApp Web.");
    const url = `https://web.whatsapp.com/send?phone=${normalized}`;
    const browsers = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
    for (const browser of browsers) {
      const opened = await new Promise((resolve) => {
        const child = spawn(browser, ["--new-tab", url], { detached: true, stdio: "ignore" });
        child.once("error", () => resolve(false));
        child.once("spawn", () => { child.unref(); resolve(true); });
      });
      if (opened) return true;
    }
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle("nexus:open-email-compose", async (_event, recipient, subject, body) => {
    const email = String(recipient || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido para o cliente.");
    const query = new URLSearchParams({ subject: String(subject || ""), body: String(body || "") });
    await shell.openExternal(`mailto:${encodeURIComponent(email)}?${query.toString()}`);
    return true;
  });
  ipcMain.handle("nexus:import-dolibarr", async () => {
    try { return await syncDolibarrToStore(); } catch (error) { console.error("Dolibarr import failed:", error); throw error; }
  });
  ipcMain.handle("nexus:select-and-save-document", async (_event, clientId) => {
    if (!store.getById("clients", clientId)) throw new Error("Cliente não encontrado na empresa ativa.");
    const result = await dialog.showOpenDialog({
      title: "Salvar arquivo na pasta do cliente",
      properties: ["openFile"],
      filters: [{ name: "Documentos e planilhas", extensions: ["pdf", "xml", "xlsx", "xls", "csv", "doc", "docx", "jpg", "jpeg", "png"] }]
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const destinationDirectory = path.join(app.getPath("userData"), "client-files", safePathSegment(store.requireActiveCompany()), safePathSegment(clientId));
    const destinationPath = path.join(destinationDirectory, `${Date.now()}-${fileName}`);
    await fs.mkdir(destinationDirectory, { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);

    return { name: fileName, localPath: destinationPath };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

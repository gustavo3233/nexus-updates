const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusDocuments", {
  selectAndSave: (clientId) => ipcRenderer.invoke("nexus:select-and-save-document", clientId),
  importDolibarr: () => ipcRenderer.invoke("nexus:import-dolibarr")
});

contextBridge.exposeInMainWorld("nexusExternal", {
  openWhatsAppWeb: (phone) => ipcRenderer.invoke("nexus:open-whatsapp-web", phone),
  openEmailCompose: (recipient, subject, body) => ipcRenderer.invoke("nexus:open-email-compose", recipient, subject, body)
});

contextBridge.exposeInMainWorld("nexusAuth", {
  status: () => ipcRenderer.invoke("nexus:auth-status"),
  setupAdmin: (details) => ipcRenderer.invoke("nexus:auth-setup-admin", details),
  login: (details) => ipcRenderer.invoke("nexus:auth-login", details),
  logout: () => ipcRenderer.invoke("nexus:auth-logout"),
  updateAccount: (details) => ipcRenderer.invoke("nexus:auth-update-account", details),
  users: () => ipcRenderer.invoke("nexus:auth-users-list"),
  createUser: (details) => ipcRenderer.invoke("nexus:auth-users-create", details),
  updateUser: (userId, details) => ipcRenderer.invoke("nexus:auth-users-update", userId, details)
});

contextBridge.exposeInMainWorld("nexusLicense", {
  status: () => ipcRenderer.invoke("nexus:license-status"),
  activate: (key) => ipcRenderer.invoke("nexus:license-activate", key)
});

contextBridge.exposeInMainWorld("nexusUpdates", {
  status: () => ipcRenderer.invoke("nexus:update-status"),
  check: () => ipcRenderer.invoke("nexus:update-check"),
  download: () => ipcRenderer.invoke("nexus:update-download"),
  install: () => ipcRenderer.invoke("nexus:update-install")
});

contextBridge.exposeInMainWorld("nexusDatabase", {
  bootstrap: () => ipcRenderer.invoke("nexus:app-bootstrap"),
  snapshot: () => ipcRenderer.invoke("nexus:database-snapshot"),
  companies: () => ipcRenderer.invoke("nexus:companies-list"),
  createCompany: (company) => ipcRenderer.invoke("nexus:companies-create", company),
  selectCompany: (companyId) => ipcRenderer.invoke("nexus:companies-select", companyId),
  save: (entity, record) => ipcRenderer.invoke("nexus:database-save", entity, record),
  deleteLedgerEntry: (entryId) => ipcRenderer.invoke("nexus:database-delete-ledger-entry", entryId),
  deleteFinancialSheet: (sheetId) => ipcRenderer.invoke("nexus:database-delete-financial-sheet", sheetId),
  saveFinancing: (financing) => ipcRenderer.invoke("nexus:database-save-financing", financing),
  deleteFinancing: (financingId) => ipcRenderer.invoke("nexus:database-delete-financing", financingId),
  deleteBudget: (budgetId) => ipcRenderer.invoke("nexus:database-delete-budget", budgetId),
  deleteOrder: (orderId) => ipcRenderer.invoke("nexus:database-delete-order", orderId),
  saveWorkDay: (day) => ipcRenderer.invoke("nexus:database-save-work-day", day),
  savePurchase: (purchase) => ipcRenderer.invoke("nexus:database-save-purchase", purchase),
  saveSettings: (settings) => ipcRenderer.invoke("nexus:database-save-settings", settings),
  saveFiscalSettings: (settings) => ipcRenderer.invoke("nexus:fiscal-save-settings", settings),
  saveFiscalDraft: (budgetId, draft) => ipcRenderer.invoke("nexus:fiscal-save-draft", budgetId, draft),
  importA1Certificate: (details) => ipcRenderer.invoke("nexus:fiscal-import-a1", details),
  confirmService: (completion) => ipcRenderer.invoke("nexus:fiscal-confirm-service", completion),
  prepareNfse: (budgetId) => ipcRenderer.invoke("nexus:fiscal-prepare-nfse", budgetId),
  fiscalDiagnostics: () => ipcRenderer.invoke("nexus:fiscal-homologation-diagnostics"),
  status: () => ipcRenderer.invoke("nexus:database-status")
});

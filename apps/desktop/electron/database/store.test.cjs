const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { NexusStore } = require("./store.cjs");

async function openCompanyStore(root, id = "company-test", name = "Empresa Teste") {
  const store = new NexusStore(root); await store.open(); store.createCompany({ id, legalName: name, tradeName: name }); return store;
}

test("instalação nova inicia sem empresa, CNPJ, certificado ou dados da Nexus", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-empty-install-")); const store = new NexusStore(root); await store.open(); const snapshot = store.snapshot();
  assert.equal(snapshot.activeCompany, null); assert.equal(snapshot.companies.length, 0); assert.equal(snapshot.clients.length, 0); assert.equal(snapshot.settings, null); assert.equal(snapshot.fiscalSettings, null); assert.equal(snapshot.certificateReferences.length, 0);
  assert.throws(() => store.save("clients", { id: "blocked", name: "Sem empresa", active: true }), /Nenhuma empresa ativa/);
});

test("migração preserva IDs, vínculos e é idempotente", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-store-"));
  const store = await openCompanyStore(root);
  const payload = {
    clients: [{ id: "client-1", name: "Cliente Teste", active: true, document: "", phone: "", email: "", address: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z" }],
    budgets: [{ id: "budget-1", clientId: "client-1", title: "Obra Teste", description: "", workAddress: "", companyName: "", companyDocument: "", companyCity: "", items: [{ id: "item-1", description: "Serviço", quantity: 1, unit: "un", unitPrice: 100, icmsRate: 0, issRate: 0 }], estimatedExpenses: [], paymentMethod: "", executionPeriod: "", totalValue: 100, issueDate: "2026-01-01", validUntil: "", observations: "", status: "Aprovado", createdAt: "2026-01-01T00:00:00.000Z" }],
    financialSheets: [{ id: "sheet-1", clientId: "client-1", budgetId: "budget-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", expenses: [{ id: "expense-1", date: "2026-01-02", category: "materiais", description: "Material", amount: 30 }] }],
    orders: [], clientFiles: [], settings: { icmsRate: 10, stateRate: 0, federalRate: 0, companyProfitRate: 15 }
  };
  const backup = await store.backup(payload);
  assert.equal(backup.verified, true);
  assert.equal(store.migrateLegacy(payload).migrated, true);
  assert.equal(store.migrateLegacy(payload).migrated, false);
  const snapshot = store.snapshot();
  assert.equal(snapshot.clients.length, 1);
  assert.equal(snapshot.budgets.length, 1);
  assert.equal(snapshot.financialSheets[0].budgetId, "budget-1");
  assert.equal(snapshot.financialSheets[0].expenses[0].id, "expense-1");
  assert.equal(snapshot.budgets[0].pricingSnapshot.companyProfitRate, 15);
});

test("diária cria gasto de funcionário sem duplicar na planilha da obra", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-work-day-"));
  const store = await openCompanyStore(root);
  const stamp = "2026-02-01T00:00:00.000Z";
  store.save("clients", { id: "client-1", name: "Cliente", active: true, createdAt: stamp });
  store.save("budgets", { id: "budget-1", clientId: "client-1", title: "Obra", status: "Aprovado", issueDate: "2026-02-01", items: [], estimatedExpenses: [], createdAt: stamp });
  store.save("works", { id: "work-1", number: "OB-1", clientId: "client-1", budgetId: "budget-1", status: "Em execução", statusHistory: [], dailyLogs: [], createdAt: stamp });
  store.save("professionals", { id: "pro-1", name: "Ana", active: true, dailyRate: 200, createdAt: stamp });
  const result = store.saveWorkDayAndExpense({ id: "day-1", professionalId: "pro-1", workId: "work-1", date: "2026-02-02", dailyRate: 200, overtimeAmount: 50, notes: "", createdAt: stamp, updatedAt: stamp });
  assert.equal(result.financialSheet.expenses.length, 1);
  assert.equal(result.financialSheet.expenses[0].category, "funcionario");
  assert.equal(result.financialSheet.expenses[0].amount, 250);
  assert.equal(store.snapshot().workDays.length, 1);
  assert.throws(() => store.saveWorkDayAndExpense({ id: "day-2", professionalId: "pro-1", workId: "work-1", date: "2026-02-02", dailyRate: 200, overtimeAmount: 0, notes: "", createdAt: stamp, updatedAt: stamp }), /Já existe uma diária/);
});

test("compra vinculada à obra gera gasto de materiais e preserva histórico", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-purchase-"));
  const store = await openCompanyStore(root); const stamp = "2026-03-01T00:00:00.000Z";
  store.save("clients", { id: "client-1", name: "Cliente", active: true, createdAt: stamp });
  store.save("budgets", { id: "budget-1", clientId: "client-1", title: "Obra", status: "Aprovado", issueDate: "2026-03-01", items: [], estimatedExpenses: [], createdAt: stamp });
  store.save("works", { id: "work-1", number: "OB-1", clientId: "client-1", budgetId: "budget-1", status: "Em execução", statusHistory: [], dailyLogs: [], createdAt: stamp });
  store.save("suppliers", { id: "supplier-1", name: "Loja de Materiais", active: true, createdAt: stamp });
  const result = store.savePurchaseAndExpense({ id: "purchase-1", supplierId: "supplier-1", workId: "work-1", date: "2026-03-02", expectedDeliveryDate: "", paymentMethod: "Pix", notes: "", items: [{ id: "line-1", description: "Cimento", quantity: 5, unit: "sc", unitPrice: 40 }], totalAmount: 200, createdAt: stamp, updatedAt: stamp });
  assert.equal(result.financialSheet.expenses[0].category, "materiais");
  assert.equal(result.financialSheet.expenses[0].amount, 200);
  assert.equal(store.snapshot().purchases[0].items[0].description, "Cimento");
});

test("documentos preservam vínculo, versão e situação de assinatura", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-document-"));
  const store = await openCompanyStore(root); const stamp = "2026-04-01T00:00:00.000Z";
  store.save("clients", { id: "client-1", name: "Cliente", active: true, createdAt: stamp });
  store.save("documents", { id: "doc-1", type: "Contrato de prestação de serviços", title: "Contrato", clientId: "client-1", content: "Conteúdo", signatureStatus: "Pendente de assinatura", version: 1, createdAt: stamp, updatedAt: stamp });
  store.save("documents", { id: "doc-1", type: "Contrato de prestação de serviços", title: "Contrato", clientId: "client-1", content: "Conteúdo revisado", signatureStatus: "Assinado (controle interno)", version: 2, createdAt: stamp, updatedAt: stamp });
  const document = store.snapshot().documents[0];
  assert.equal(document.version, 2);
  assert.equal(document.signatureStatus, "Assinado (controle interno)");
});

test("exclusão de orçamento remove vínculos operacionais da empresa ativa", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-budget-delete-"));
  const store = await openCompanyStore(root); const stamp = "2026-04-15T00:00:00.000Z";
  store.save("clients", { id: "client-1", name: "Cliente", active: true, createdAt: stamp });
  store.save("budgets", { id: "budget-1", clientId: "client-1", title: "Reforma", status: "Rascunho", issueDate: "2026-04-15", items: [], estimatedExpenses: [], createdAt: stamp });
  store.save("works", { id: "work-1", number: "OB-DELETE-1", clientId: "client-1", budgetId: "budget-1", status: "Agendada", statusHistory: [], dailyLogs: [], createdAt: stamp });
  store.save("financial_sheets", { id: "sheet-1", clientId: "client-1", budgetId: "budget-1", expenses: [{ id: "expense-1", date: "2026-04-15", category: "materiais", description: "Material", amount: 50 }], createdAt: stamp, updatedAt: stamp });
  store.save("professionals", { id: "pro-1", name: "Ana", active: true, createdAt: stamp });
  store.save("work_days", { id: "day-1", professionalId: "pro-1", workId: "work-1", date: "2026-04-15", dailyRate: 100, overtimeAmount: 0, notes: "", createdAt: stamp, updatedAt: stamp });
  store.save("suppliers", { id: "supplier-1", name: "Fornecedor", active: true, createdAt: stamp });
  store.save("purchases", { id: "purchase-1", supplierId: "supplier-1", workId: "work-1", date: "2026-04-15", expectedDeliveryDate: "", paymentMethod: "Pix", notes: "", items: [], totalAmount: 50, createdAt: stamp, updatedAt: stamp });
  store.save("documents", { id: "doc-1", type: "Contrato de prestação de serviços", title: "Contrato", clientId: "client-1", budgetId: "budget-1", workId: "work-1", content: "", signatureStatus: "Pendente de assinatura", version: 1, createdAt: stamp, updatedAt: stamp });
  store.save("ledger_entries", { id: "ledger-1", kind: "receivable", clientId: "client-1", budgetId: "budget-1", workId: "work-1", dueDate: "2026-04-20", status: "Pendente", payments: [], createdAt: stamp, updatedAt: stamp });
  const result = store.deleteBudget("budget-1");
  assert.deepEqual(result, { works: 1, financialSheets: 1, documents: 1, ledgerEntries: 1, workDays: 1, purchases: 1 });
  const snapshot = store.snapshot();
  assert.equal(snapshot.budgets.length, 0); assert.equal(snapshot.works.length, 0); assert.equal(snapshot.financialSheets.length, 0); assert.equal(snapshot.workDays.length, 0); assert.equal(snapshot.purchases.length, 0); assert.equal(snapshot.documents.length, 0); assert.equal(snapshot.ledgerEntries.length, 0);
  assert.equal(store.db.prepare("SELECT count(*) AS total FROM audit_log WHERE action='deleted' AND entity='budgets'").get().total, 1);
});

test("fundação fiscal preserva dados existentes e exige confirmação explícita", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-nfse-foundation-"));
  const store = await openCompanyStore(root); const stamp = "2026-05-01T00:00:00.000Z";
  store.save("clients", { id: "client-1", name: "Cliente", active: true, document: "12345678901", address: "Rua A, 1", createdAt: stamp });
  store.save("orders", { id: "order-1", clientId: "client-1", type: "Ordem de serviço", subject: "Reforma", workAddress: "Rua A, 1", scheduledDate: "2026-05-01", professional: "Responsável", description: "Serviço", observations: "", createdAt: stamp });
  store.save("budgets", { id: "budget-1", clientId: "client-1", sourceOrderId: "order-1", title: "Reforma", status: "Aprovado", issueDate: "2026-05-01", items: [], estimatedExpenses: [], totalValue: 1000, createdAt: stamp });
  store.save("works", { id: "work-1", number: "OB-1", clientId: "client-1", budgetId: "budget-1", status: "Concluída", statusHistory: [], dailyLogs: [], createdAt: stamp });
  const before = store.snapshot();
  assert.equal(before.clients.length, 1); assert.equal(before.budgets[0].status, "Aprovado");
  assert.throws(() => store.prepareNfse("budget-1"), /Confirme explicitamente/);
  store.confirmServiceCompletion({ id: "completion-1", budgetId: "budget-1", workId: "work-1", orderId: "order-1", completedOn: "2026-05-02", confirmedBy: "Admin", notes: "Concluído", createdAt: stamp, updatedAt: stamp });
  assert.throws(() => store.prepareNfse("budget-1"), /Configurações fiscais pendentes/);
  const fiscal = store.saveFiscalSettings({ id: "singleton", legalName: "Nexus Construção Ltda", cnpj: "12.345.678/0001-90", municipalRegistration: "12345", taxRegime: "Confirmado", municipalityName: "Porto Alegre/RS", municipalityIbgeCode: "4314902", defaultServiceCode: "codigo-validado", defaultServiceDescription: "Serviço validado", issRate: 3, retentions: { issRate: null, irrfRate: null, pisRate: null, cofinsRate: null, csllRate: null, inssRate: null, confirmed: true, notes: "Confirmado" }, dpsSeries: "A", updatedAt: stamp });
  assert.equal(fiscal.cnpj, "12.345.678/0001-90");
  store.saveNfseDraft("budget-1", { title: "Reforma", serviceDescription: "Serviço validado", paymentDescription: "Pix", serviceValue: 1000, discounts: 0 });
  const prepared = store.prepareNfse("budget-1");
  assert.equal(prepared.record.status, "DPS preparada");
  assert.equal(prepared.record.dpsNumber, 1);
  assert.equal(prepared.attempt.operation, "preparação");
  assert.throws(() => store.prepareNfse("budget-1"), /Já existe uma NFS-e/);
  assert.throws(() => store.deleteBudget("budget-1"), /registro fiscal/);
  const after = store.snapshot();
  assert.equal(after.clients.length, 1); assert.equal(after.budgets.length, 1); assert.equal(after.budgets[0].status, "Aprovado");
  assert.equal(after.serviceCompletions.length, 1); assert.equal(after.nfseRecords.length, 1); assert.equal(after.nfseAttempts.length, 1);
  assert.equal(store.db.prepare("SELECT count(*) n FROM audit_log WHERE entity='nfse_record'").get().n, 1);
});

test("numeração DPS é transacional e não reutiliza número entre orçamentos", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-nfse-sequence-"));
  const store = await openCompanyStore(root); const stamp = "2026-06-01T00:00:00.000Z";
  store.saveFiscalSettings({ id: "singleton", legalName: "Nexus", cnpj: "12.345.678/0001-90", municipalRegistration: "1", taxRegime: "Confirmado", municipalityName: "Porto Alegre/RS", municipalityIbgeCode: "4314902", defaultServiceCode: "validado", defaultServiceDescription: "Serviço", issRate: 2, retentions: { issRate: null, irrfRate: null, pisRate: null, cofinsRate: null, csllRate: null, inssRate: null, confirmed: true, notes: "" }, dpsSeries: "1", updatedAt: stamp });
  for (const index of [1, 2]) { store.save("clients", { id: `client-${index}`, name: `Cliente ${index}`, active: true, document: `1234567890${index}`, address: "Rua", createdAt: stamp }); store.save("budgets", { id: `budget-${index}`, clientId: `client-${index}`, title: "Serviço", status: "Aprovado", issueDate: "2026-06-01", items: [], estimatedExpenses: [], totalValue: 100, createdAt: stamp }); store.save("works", { id: `work-${index}`, number: `OB-${index}`, clientId: `client-${index}`, budgetId: `budget-${index}`, status: "Concluída", statusHistory: [], dailyLogs: [], createdAt: stamp }); store.confirmServiceCompletion({ id: `completion-${index}`, budgetId: `budget-${index}`, workId: `work-${index}`, completedOn: "2026-06-02", confirmedBy: "Admin", notes: "", createdAt: stamp, updatedAt: stamp }); store.saveNfseDraft(`budget-${index}`, { title: "Serviço", serviceDescription: "Descrição", paymentDescription: "", serviceValue: 100, discounts: 0 }); }
  const first = store.prepareNfse("budget-1").record; const second = store.prepareNfse("budget-2").record;
  assert.deepEqual([first.dpsNumber, second.dpsNumber], [1, 2]);
  assert.equal(store.db.prepare("SELECT next_number FROM dps_sequences WHERE issuer_cnpj=? AND series=?").get("12345678000190", "1").next_number, 3);
});

test("isolamento multiempresa bloqueia leitura, vínculos e dados fiscais cruzados", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-isolation-"));
  const store = await openCompanyStore(root, "company-a", "Empresa A"); const stamp = "2026-07-01T00:00:00.000Z";
  store.save("clients", { id: "client-a", name: "Cliente A", active: true, document: "12345678901", address: "Rua A", createdAt: stamp });
  store.save("budgets", { id: "budget-a", clientId: "client-a", title: "Obra A", status: "Aprovado", issueDate: "2026-07-01", items: [], estimatedExpenses: [], totalValue: 100, createdAt: stamp });
  store.save("works", { id: "work-a", number: "A-1", clientId: "client-a", budgetId: "budget-a", status: "Concluída", statusHistory: [], dailyLogs: [], createdAt: stamp });
  store.save("financial_sheets", { id: "sheet-a", clientId: "client-a", budgetId: "budget-a", expenses: [{ id: "expense-a", date: "2026-07-01", category: "materiais", description: "Material", amount: 10 }], createdAt: stamp, updatedAt: stamp });
  store.save("documents", { id: "document-a", type: "Contrato", title: "Contrato A", clientId: "client-a", content: "A", signatureStatus: "Pendente", version: 1, createdAt: stamp, updatedAt: stamp });
  const fiscalA = { id: "singleton", legalName: "Empresa A", cnpj: "12.345.678/0001-90", municipalRegistration: "1", taxRegime: "Confirmado", municipalityName: "Porto Alegre/RS", municipalityIbgeCode: "4314902", defaultServiceCode: "validado", defaultServiceDescription: "Serviço", issRate: 2, retentions: { confirmed: true }, dpsSeries: "A", updatedAt: stamp };
  store.saveFiscalSettings(fiscalA); store.registerCertificateReference({ id: "cert-a", certificateType: "A1", keychainReference: "os-keychain://a", certificateCnpj: fiscalA.cnpj, fingerprint: "a" });
  store.confirmServiceCompletion({ id: "completion-a", budgetId: "budget-a", workId: "work-a", completedOn: "2026-07-02", confirmedBy: "Admin A", notes: "", createdAt: stamp, updatedAt: stamp }); store.saveNfseDraft("budget-a", { title: "Obra A", serviceDescription: "Descrição A", paymentDescription: "", serviceValue: 100, discounts: 0 });
  const nfseA = store.prepareNfse("budget-a").record;
  store.createCompany({ id: "company-b", legalName: "Empresa B", tradeName: "Empresa B" }); store.setActiveCompany("company-b");
  assert.equal(store.snapshot().clients.length, 0); assert.equal(store.snapshot().budgets.length, 0); assert.equal(store.snapshot().works.length, 0); assert.equal(store.snapshot().financialSheets.length, 0); assert.equal(store.snapshot().documents.length, 0); assert.equal(store.snapshot().fiscalSettings, null); assert.equal(store.snapshot().certificateReferences.length, 0); assert.equal(store.snapshot().nfseRecords.length, 0);
  assert.equal(store.getById("clients", "client-a"), null);
  assert.throws(() => store.save("budgets", { id: "budget-cross", clientId: "client-a", title: "Bloqueado", status: "Rascunho", items: [], estimatedExpenses: [], createdAt: stamp }), /Cliente inválido/);
  assert.throws(() => store.save("clients", { id: "client-a", companyId: "company-a", name: "Tentativa", active: true, createdAt: stamp }), /empresa informada/);
  store.save("clients", { id: "client-b", name: "Cliente B", active: true, document: "98765432100", address: "Rua B", createdAt: stamp });
  store.save("budgets", { id: "budget-b", clientId: "client-b", title: "Obra B", status: "Aprovado", issueDate: "2026-07-01", items: [], estimatedExpenses: [], totalValue: 100, createdAt: stamp });
  store.save("works", { id: "work-b", number: "B-1", clientId: "client-b", budgetId: "budget-b", status: "Concluída", statusHistory: [], dailyLogs: [], createdAt: stamp });
  const fiscalB = { ...fiscalA, legalName: "Empresa B", cnpj: "98.765.432/0001-10", dpsSeries: "A" }; store.saveFiscalSettings(fiscalB);
  store.registerCertificateReference({ id: "cert-b", certificateType: "A1", keychainReference: "os-keychain://b", certificateCnpj: fiscalB.cnpj, fingerprint: "b" });
  store.confirmServiceCompletion({ id: "completion-b", budgetId: "budget-b", workId: "work-b", completedOn: "2026-07-02", confirmedBy: "Admin B", notes: "", createdAt: stamp, updatedAt: stamp }); store.saveNfseDraft("budget-b", { title: "Obra B", serviceDescription: "Descrição B", paymentDescription: "", serviceValue: 100, discounts: 0 });
  const nfseB = store.prepareNfse("budget-b").record;
  assert.equal(nfseA.dpsNumber, 1); assert.equal(nfseB.dpsNumber, 1); assert.equal(store.snapshot().clients[0].id, "client-b"); assert.equal(store.snapshot().certificateReferences[0].id, "cert-b");
  store.setActiveCompany("company-a"); assert.equal(store.snapshot().clients[0].id, "client-a"); assert.equal(store.snapshot().nfseRecords[0].id, nfseA.id); assert.equal(store.snapshot().certificateReferences[0].id, "cert-a");
});

test("financiamento preserva parcelas e bloqueia vínculos entre empresas", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-financing-")); const store = await openCompanyStore(root, "company-a", "Empresa A"); const stamp = "2026-11-03T00:00:00.000Z";
  store.save("clients", { id: "client-a", name: "Cliente A", active: true, createdAt: stamp });
  store.save("budgets", { id: "budget-a", clientId: "client-a", title: "Obra A", status: "Aprovado", items: [], estimatedExpenses: [], totalValue: 1000, createdAt: stamp });
  store.save("works", { id: "work-a", number: "OB-A", clientId: "client-a", budgetId: "budget-a", status: "Agendada", statusHistory: [], dailyLogs: [], createdAt: stamp });
  const financing = store.saveFinancing({ id: "financing-a", clientId: "client-a", workId: "work-a", budgetId: "budget-a", principalAmount: 1000, installmentRate: 3, installmentsCount: 2, firstPaymentDate: "2026-12-10", totalFinanced: 1030, installments: [{ number: 1, dueDate: "2026-12-10", amount: 515 }, { number: 2, dueDate: "2027-01-10", amount: 515 }], createdAt: stamp, updatedAt: stamp });
  assert.equal(financing.companyId, "company-a"); assert.equal(store.snapshot().financings[0].totalFinanced, 1030);
  assert.throws(() => store.deleteBudget("budget-a"), /financiamento/);
  store.createCompany({ id: "company-b", legalName: "Empresa B", tradeName: "Empresa B" }); store.setActiveCompany("company-b");
  assert.equal(store.snapshot().financings.length, 0);
  assert.throws(() => store.saveFinancing({ ...financing, id: "financing-cross" }), /não pertence à empresa ativa/);
});

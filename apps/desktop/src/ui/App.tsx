import { useEffect, useMemo, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { ClientFile, ClientFileCategory } from "../domain/client-file";
import type { FinancialSheet } from "../domain/financial-sheet";
import type { Order } from "../domain/order";
import type { Settings } from "../domain/settings";
import type { Work } from "../domain/work";
import { installmentStatus, type Financing } from "../domain/financing";
import { currentLedgerStatus, type LedgerEntry } from "../domain/ledger";
import type { Professional, WorkDay } from "../domain/professional";
import type { Purchase, Supplier } from "../domain/supplier";
import type { NexusDocument } from "../domain/document";
import type { FiscalSettings, NfseRecord, ServiceCompletion } from "../domain/fiscal";
import { createWorkFromBudget } from "../domain/work";
import { defaultSettings } from "../domain/settings";
import { generateBudgetPdf } from "../services/budget-pdf";
import { generateOrderPdf } from "../services/order-pdf";
import { BudgetForm } from "./BudgetForm";
import { BudgetsView } from "./BudgetsView";
import { ClientFolder } from "./ClientFolder";
import { ClientForm } from "./ClientForm";
import { ClientsView } from "./ClientsView";
import { DashboardView } from "./DashboardView";
import { FinanceView } from "./FinanceView";
import { FinancingView } from "./FinancingView";
import { OrderForm } from "./OrderForm";
import { SettingsView } from "./SettingsView";
import { WorksView } from "./WorksView";
import { CashFlowView } from "./CashFlowView";
import { ProfessionalsView } from "./ProfessionalsView";
import { SuppliersView } from "./SuppliersView";
import { DocumentsView } from "./DocumentsView";
import { SystemIcon } from "./SystemIcon";
import { FiscalSettingsPanel } from "./FiscalSettingsPanel";
import { FiscalReadinessPanel } from "./FiscalReadinessPanel";

type View = "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "documents" | "finance" | "cashflow" | "financing" | "folder" | "settings";
type SearchResult = { client: Client; detail: string };
type Company = { id: string; legalName: string; tradeName: string };

export function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [sheets, setSheets] = useState<FinancialSheet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [financings, setFinancings] = useState<Financing[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [documents, setDocuments] = useState<NexusDocument[]>([]);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings | null>(null);
  const [serviceCompletions, setServiceCompletions] = useState<ServiceCompletion[]>([]);
  const [nfseRecords, setNfseRecords] = useState<NfseRecord[]>([]);
  const [nfseDrafts, setNfseDrafts] = useState<any[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [folderClientId, setFolderClientId] = useState<string | null>(null);
  const [folderBudgetId, setFolderBudgetId] = useState<string | null>(null);
  const [budgetClientId, setBudgetClientId] = useState<string | null>(null);
  const [budgetOrder, setBudgetOrder] = useState<Order | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [clientForm, setClientForm] = useState(false);
  const [orderForm, setOrderForm] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const loadSnapshot = () => window.nexusDatabase?.snapshot().then((snapshot) => {
    setCompanies(snapshot.companies); setActiveCompany(snapshot.activeCompany);
    setClients(snapshot.clients); setBudgets(snapshot.budgets); setFiles(snapshot.clientFiles);
    setSheets(snapshot.financialSheets); setOrders(snapshot.orders); setWorks(snapshot.works); setFinancings(snapshot.financings); setLedgerEntries(snapshot.ledgerEntries); setProfessionals(snapshot.professionals); setWorkDays(snapshot.workDays); setSuppliers(snapshot.suppliers); setPurchases(snapshot.purchases); setDocuments(snapshot.documents); setFiscalSettings(snapshot.fiscalSettings); setServiceCompletions(snapshot.serviceCompletions); setNfseDrafts(snapshot.nfseDrafts as any[]); setNfseRecords(snapshot.nfseRecords); setSettings({ ...defaultSettings, ...(snapshot.settings ?? {}) });
  }).catch((error) => console.error("Não foi possível carregar o banco local.", error));

  useEffect(() => {
    loadSnapshot();
  }, []);

  const activeClient = clients.find((item) => item.id === folderClientId) ?? null;
  const searchResults = useMemo<SearchResult[]>(() => {
    const term = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!term) return [];
    const found = new Map<string, SearchResult>();
    for (const client of clients) {
      const text = [client.name, client.id, client.document, client.phone, client.email].join(" ").toLocaleLowerCase("pt-BR");
      if (text.includes(term)) found.set(client.id, { client, detail: "Cliente • ID " + client.id });
    }
    for (const budget of budgets) {
      const text = [budget.id, budget.title, budget.description].join(" ").toLocaleLowerCase("pt-BR");
      if (text.includes(term)) {
        const client = clients.find((item) => item.id === budget.clientId);
        if (client && !found.has(client.id)) found.set(client.id, { client, detail: "Orçamento " + budget.title + " • " + budget.id });
      }
    }
    return Array.from(found.values()).slice(0, 8);
  }, [searchQuery, clients, budgets]);
  const notifications = useMemo(() => {
    const financingAlerts = financings.flatMap((financing) => financing.installments.filter((installment) => installmentStatus(installment) === "Vencida").map((installment) => ({ id: financing.id + "-" + installment.number, text: "Parcela " + installment.number + " do financiamento está vencida.", view: "financing" as View })));
    const cashAlerts = ledgerEntries.filter((entry) => currentLedgerStatus(entry) === "Vencido").map((entry) => ({ id: entry.id, text: "Lançamento vencido: " + (entry.description || "sem descrição") + ".", view: "cashflow" as View }));
    return [...financingAlerts, ...cashAlerts];
  }, [financings, ledgerEntries]);

  const openFolder = (clientOrId: Client | string) => {
    setFolderBudgetId(null);
    setFolderClientId(typeof clientOrId === "string" ? clientOrId : clientOrId.id);
    setView("folder");
  };
  const openBudgetInFolder = (budget: Budget) => {
    setFolderClientId(budget.clientId);
    setFolderBudgetId(budget.id);
    setView("folder");
  };
  const openSearchResult = (result: SearchResult) => {
    openFolder(result.client);
    setSearchQuery("");
    setSearchOpen(false);
  };
  const persist = (entity: "clients" | "budgets" | "financial_sheets" | "orders" | "client_files" | "works" | "ledger_entries" | "professionals" | "suppliers" | "documents", record: unknown) => { window.nexusDatabase?.save(entity, record).catch((error) => console.error("Falha ao gravar no banco local.", error)); };
  const addClient = (client: Client) => { setClients((current) => [...current.filter((item) => item.id !== client.id), client].sort((a, b) => a.name.localeCompare(b.name))); persist("clients", client); setClientForm(false); };
  const addBudget = (budget: Budget) => { const stored = { ...budget, number: budget.number ?? String(budgets.filter((item) => !item.id.startsWith("dolibarr-budget-")).length + 1).padStart(2, "0"), pricingSnapshot: budget.pricingSnapshot ?? { icmsRate: settings.icmsRate, stateRate: settings.stateRate, federalRate: settings.federalRate, companyProfitRate: settings.companyProfitRate, applyTaxes: true, applyProfit: true, capturedAt: new Date().toISOString() } }; setBudgets((current) => [stored, ...current.filter((item) => item.id !== stored.id)]); persist("budgets", stored); setBudgetClientId(null); setBudgetOrder(null); setEditingBudget(null); };
  const deleteBudget = async (budget: Budget) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    await window.nexusDatabase.deleteBudget(budget.id);
    setFolderBudgetId(null);
    await loadSnapshot();
  };
  const addOrder = (order: Order) => { setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]); persist("orders", order); setOrderForm(false); };
  const addWork = (work: Work) => { setWorks((current) => [work, ...current.filter((item) => item.id !== work.id)]); persist("works", work); };
  const addFinancing = async (financing: Financing) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); const saved = await window.nexusDatabase.saveFinancing(financing); setFinancings((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); };
  const removeFinancing = async (financingId: string) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); await window.nexusDatabase.deleteFinancing(financingId); setFinancings((current) => current.filter((item) => item.id !== financingId)); };
  const addLedgerEntry = (entry: LedgerEntry) => { setLedgerEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]); persist("ledger_entries", entry); };
  const addProfessional = (professional: Professional) => { setProfessionals((current) => [...current.filter((item) => item.id !== professional.id), professional].sort((a, b) => a.name.localeCompare(b.name))); persist("professionals", professional); };
  const addWorkDay = async (day: WorkDay) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    const saved = await window.nexusDatabase.saveWorkDay(day);
    setWorkDays((current) => [saved.day, ...current.filter((item) => item.id !== saved.day.id)]);
    setSheets((current) => [saved.financialSheet, ...current.filter((item) => item.id !== saved.financialSheet.id)]);
  };
  const addSupplier = (supplier: Supplier) => { setSuppliers((current) => [...current.filter((item) => item.id !== supplier.id), supplier].sort((a, b) => a.name.localeCompare(b.name))); persist("suppliers", supplier); };
  const addPurchase = async (purchase: Purchase) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    const saved = await window.nexusDatabase.savePurchase(purchase);
    setPurchases((current) => [saved.purchase, ...current.filter((item) => item.id !== saved.purchase.id)]);
    if (saved.financialSheet) setSheets((current) => [saved.financialSheet!, ...current.filter((item) => item.id !== saved.financialSheet!.id)]);
  };
  const addDocument = (document: NexusDocument) => { setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]); persist("documents", document); };
  const saveFiscalSettings = async (next: FiscalSettings) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); const saved = await window.nexusDatabase.saveFiscalSettings(next); setFiscalSettings(saved); };
  const confirmService = async (completion: ServiceCompletion) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); const saved = await window.nexusDatabase.confirmService(completion); setServiceCompletions((current) => [saved, ...current.filter((item) => item.budgetId !== saved.budgetId)]); };
  const prepareNfse = async (budgetId: string) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); const saved = await window.nexusDatabase.prepareNfse(budgetId); setNfseRecords((current) => [saved.record, ...current.filter((item) => item.id !== saved.record.id)]); return saved.record; };
  const createWork = (budget: Budget) => {
    if (works.some((work) => work.budgetId === budget.id)) return;
    addWork(createWorkFromBudget(budget));
    setView("works");
  };
  const upload = async (category: ClientFileCategory) => {
    if (!activeClient || !window.nexusDocuments) return;
    const file = await window.nexusDocuments.selectAndSave(activeClient.id);
    if (file) { const record = { ...file, id: crypto.randomUUID(), clientId: activeClient.id, category, createdAt: new Date().toISOString() }; setFiles((current) => [record, ...current]); persist("client_files", record); }
  };
  const nav = (target: "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "documents" | "finance" | "cashflow" | "financing" | "settings") => "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm " + (view === target ? "bg-nexus-primary font-semibold text-white shadow-sm" : "text-slate-200 hover:bg-slate-800");
  const logo = settings.appLogoDataUrl || settings.logoDataUrl;
  const hasHeaderText = settings.showHeaderText;
  const direction = hasHeaderText && settings.headerLayout === "row" ? "flex-row gap-3" : "flex-col";

  const pageTitles: Record<View, string> = { dashboard: "Dashboard", clients: "Clientes", budgets: "Orçamentos", works: "Obras", professionals: "Profissionais", suppliers: "Fornecedores", documents: "Documentos", finance: "Financeiro", cashflow: "Fluxo de caixa", financing: "Financiamento", folder: "Pasta do cliente", settings: "Configurações" };
  const pageIcons: Record<View, "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "documents" | "finance" | "cashflow" | "financing" | "settings"> = { dashboard: "dashboard", clients: "clients", budgets: "budgets", works: "works", professionals: "professionals", suppliers: "suppliers", documents: "documents", finance: "finance", cashflow: "cashflow", financing: "financing", folder: "clients", settings: "settings" };
  return <div className="flex h-screen overflow-hidden bg-slate-50">
    <aside className="flex w-52 shrink-0 flex-col bg-nexus-ink px-3 py-4 text-white">
      <div className={"flex " + direction + " items-center border-b border-slate-700 pb-4"}>
        {logo ? <img src={logo} style={{ width: settings.appLogoSize, height: settings.appLogoSize }} className="object-contain" /> : <div style={{ width: settings.appLogoSize, height: settings.appLogoSize }} className="flex items-center justify-center rounded bg-nexus-primary text-2xl font-bold">N</div>}
        {hasHeaderText && <div>
<b className="text-lg">{settings.companyName}</b>
<p className="text-[10px] tracking-widest text-slate-300">{settings.companySubtitle}</p>
</div>}
      </div>
      <nav className="mt-5 space-y-1">
        <button className={nav("dashboard")}
onClick={() => setView("dashboard")}>
<SystemIcon name="dashboard" className="h-5 w-5"/>Dashboard</button>
        <button className={nav("clients")}
onClick={() => setView("clients")}>
<SystemIcon name="clients" className="h-5 w-5"/>Clientes</button>
        <button className={nav("budgets")}
onClick={() => setView("budgets")}>
<SystemIcon name="budgets" className="h-5 w-5"/>Orçamentos</button>
        <button className={nav("works")}
onClick={() => setView("works")}>
<SystemIcon name="works" className="h-5 w-5"/>Obras</button>
        <button className={nav("professionals")}
onClick={() => setView("professionals")}>
<SystemIcon name="professionals" className="h-5 w-5"/>Profissionais</button>
        <button className={nav("suppliers")}
onClick={() => setView("suppliers")}>
<SystemIcon name="suppliers" className="h-5 w-5"/>Fornecedores</button>
        <button className={nav("documents")}
onClick={() => setView("documents")}>
<SystemIcon name="documents" className="h-5 w-5"/>Documentos</button>
        <button className={nav("finance")}
onClick={() => setView("finance")}>
<SystemIcon name="finance" className="h-5 w-5"/>Financeiro</button>
        <button className={nav("cashflow")}
onClick={() => setView("cashflow")}>
<SystemIcon name="cashflow" className="h-5 w-5"/>Fluxo de caixa</button>
        <button className={nav("financing")}
onClick={() => setView("financing")}>
<SystemIcon name="financing" className="h-5 w-5"/>Financiamento</button>
        <button className={nav("settings")}
onClick={() => setView("settings")}>
<SystemIcon name="settings" className="h-5 w-5"/>Configurações</button>
      </nav>
    </aside>
    <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-6">
      <div className="sticky top-0 z-30 -mx-6 mb-5 flex h-20 items-center justify-between border-b border-slate-200 bg-white pl-6 pr-10 shadow-sm">
        <div className="flex items-center gap-4">
<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-nexus-primary">
<SystemIcon name={pageIcons[view]} className="h-5 w-5"/>
</span>
<b className="text-2xl text-nexus-ink">{pageTitles[view]}</b>
</div>
        <div className="flex items-center gap-3">{companies.length > 1 && <select aria-label="Empresa ativa" value={activeCompany?.id || ""}
onChange={async (event) => { await window.nexusDatabase?.selectCompany(event.target.value); loadSnapshot(); }} className="max-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-nexus-ink">
<option value="">Selecionar empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.tradeName}</option>)}</select>}<div className="relative"><button type="button" aria-label="Notificações" title="Notificações" onClick={() => setNotificationsOpen((open) => !open)} className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-nexus-primary bg-nexus-primary text-xl text-white shadow-sm hover:bg-orange-600">🔔{notifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[10px] font-bold text-nexus-primary">{notifications.length > 9 ? "9+" : notifications.length}</span>}</button>{notificationsOpen && <div className="absolute left-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-nexus-border bg-white shadow-xl"><div className="border-b px-4 py-3 text-sm font-semibold">Notificações</div>{notifications.length ? notifications.map((notification) => <button className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-orange-50" key={notification.id} onClick={() => { setView(notification.view); setNotificationsOpen(false); }}><b className="block text-nexus-ink">Atenção</b><span className="text-nexus-muted">{notification.text}</span></button>) : <p className="px-4 py-5 text-sm text-nexus-muted">Nenhuma notificação pendente.</p>}</div>}</div>{!searchOpen ? <button type="button"
onClick={() => setSearchOpen(true)} className="flex w-56 items-center gap-2 rounded-xl border border-blue-100 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-500 shadow-sm hover:border-nexus-primary" title="Pesquisar cliente ou orçamento">
<span className="text-lg leading-none text-nexus-ink">⌕</span> Buscar...</button> : <div className="relative w-full max-w-xl">
          <div className="flex items-center rounded-lg border border-nexus-primary bg-white px-3 py-2 shadow-sm">
<span className="mr-2 text-lg leading-none text-nexus-muted">⌕</span>
<input autoFocus value={searchQuery}
onChange={(event) => setSearchQuery(event.target.value)}
onKeyDown={(event) => { if (event.key === "Enter" && searchResults[0]) openSearchResult(searchResults[0]); if (event.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }} placeholder="Pesquisar cliente, ID ou orçamento" className="min-w-0 flex-1 outline-none" />
<button type="button"
onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="ml-2 text-nexus-muted hover:text-nexus-ink" aria-label="Fechar pesquisa">×</button>
</div>
          {searchQuery.trim() && <div className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-lg border border-nexus-border bg-white shadow-lg">{searchResults.length ? searchResults.map((result) => <button type="button" key={result.client.id}
onClick={() => openSearchResult(result)} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50">
<b className="block text-sm text-nexus-ink">{result.client.name}</b>
<span className="block text-xs text-nexus-muted">{result.detail}</span>
</button>) : <p className="px-4 py-3 text-sm text-nexus-muted">Nenhum cliente ou orçamento encontrado.</p>}</div>}
</div>}</div>
      </div>
      {view === "dashboard" && <DashboardView budgets={budgets} clients={clients} sheets={sheets} settings={settings} works={works} ledgerEntries={ledgerEntries} />}
      {view === "clients" && <ClientsView clients={clients}
onNewClient={() => setClientForm(true)}
onOpenFolder={openFolder}
onToggleActive={(client) => addClient({ ...client, active: client.active === false })} />}
      {view === "budgets" && <BudgetsView budgets={budgets} orders={orders} works={works} clients={clients} settings={settings} fiscalSettings={fiscalSettings} serviceCompletions={serviceCompletions} nfseDrafts={nfseDrafts} nfseRecords={nfseRecords}
onSaveNfseDraft={async (budgetId, draft) => { const saved = await window.nexusDatabase?.saveFiscalDraft(budgetId, draft); setNfseDrafts((current) => [saved, ...current.filter((item) => item?.budgetId !== budgetId)]); }}
onConfirmService={confirmService}
onPrepareNfse={prepareNfse}
onNewBudget={() => setBudgetClientId("")}
onNewOrder={() => setOrderForm(true)}
onEditBudget={(budget) => { setEditingBudget(budget); setBudgetClientId(budget.clientId); }}
onCreateBudgetFromOrder={(order) => { setBudgetOrder(order); setBudgetClientId(order.clientId); }}
onCreateWork={createWork}
onOpenFolder={openFolder}
onOpenBudgetInFolder={openBudgetInFolder}
onPdf={generateBudgetPdf}
onOrderPdf={generateOrderPdf} />}
      {view === "works" && <WorksView works={works} clients={clients} budgets={budgets} professionals={professionals}
onSave={addWork} />}
      {view === "professionals" && <ProfessionalsView professionals={professionals} workDays={workDays} works={works} clients={clients}
onSaveProfessional={addProfessional}
onSaveWorkDay={addWorkDay} />}
      {view === "suppliers" && <SuppliersView suppliers={suppliers} purchases={purchases} works={works}
onSaveSupplier={addSupplier}
onSavePurchase={addPurchase} />}
      {view === "documents" && <DocumentsView documents={documents} clients={clients} budgets={budgets} works={works} settings={settings}
onSave={addDocument} />}
      {view === "finance" && <FinanceView clients={clients} budgets={budgets} sheets={sheets} settings={settings}
onSave={(sheet) => { setSheets((current) => [sheet, ...current.filter((item) => item.id !== sheet.id)]); persist("financial_sheets", sheet); }} />}
      {view === "cashflow" && <CashFlowView entries={ledgerEntries} clients={clients} works={works}
onSave={addLedgerEntry} />}
      {view === "financing" && <FinancingView clients={clients} works={works} budgets={budgets} financings={financings} settings={settings} onSave={addFinancing} onDelete={removeFinancing} onOpenBudget={openBudgetInFolder} />}
      {view === "folder" && activeClient && <ClientFolder client={activeClient} budgets={budgets.filter((item) => item.clientId === activeClient.id)} files={files.filter((item) => item.clientId === activeClient.id)} sheets={sheets} settings={settings}
initialBudgetId={folderBudgetId}
onBack={() => { setFolderBudgetId(null); setView("clients"); }}
onNewBudget={() => setBudgetClientId(activeClient.id)}
onEditBudget={(budget) => { setEditingBudget(budget); setBudgetClientId(budget.clientId); }}
onCreateWork={createWork}
onUpdateBudget={addBudget}
onDeleteBudget={deleteBudget}
onUpload={upload} />}
      {view === "settings" && <>
<SettingsView initial={settings} fiscalSettings={fiscalSettings}
onSaveFiscal={saveFiscalSettings}
onSave={(next) => { setSettings(next); window.nexusDatabase?.saveSettings(next).catch((error) => console.error("Falha ao gravar configurações.", error)); window.alert("Configurações salvas."); }} />
<FiscalSettingsPanel initial={fiscalSettings}
onSave={saveFiscalSettings} />
<FiscalReadinessPanel />
</>}
    </main>
    {clientForm && <ClientForm
onCancel={() => setClientForm(false)}
onSave={addClient} />}
    {orderForm && <OrderForm clients={clients}
onCancel={() => setOrderForm(false)}
onSave={addOrder}
onClientCreated={addClient} />}
    {budgetClientId !== null && <BudgetForm key={editingBudget?.id || budgetOrder?.id || budgetClientId} clients={clients} professionals={professionals} purchases={purchases} settings={settings} initialClientId={budgetClientId} initialOrder={budgetOrder ?? undefined} initialBudget={editingBudget ?? undefined}
onCancel={() => { setBudgetClientId(null); setBudgetOrder(null); setEditingBudget(null); }}
onSave={addBudget}
onClientCreated={addClient}
onClientUpdated={addClient} />}
  </div>;
}

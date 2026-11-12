import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { emptyBudgetDraft, type Budget, type BudgetDraft, type BudgetItem } from "../domain/budget";
import type { Client } from "../domain/client";
import type { ClientFile, ClientFileCategory } from "../domain/client-file";
import type { FinancialSheet } from "../domain/financial-sheet";
import type { Order } from "../domain/order";
import type { Settings } from "../domain/settings";
import type { Work, WorkStatus } from "../domain/work";
import { installmentStatus, type Financing } from "../domain/financing";
import { balanceAmount, currentLedgerStatus, type LedgerEntry, type LedgerKind, type LedgerStatus } from "../domain/ledger";
import type { Professional, WorkDay } from "../domain/professional";
import type { Purchase, Supplier } from "../domain/supplier";
import type { NexusDocument } from "../domain/document";
import type { Product, ProductStockMovement } from "../domain/product";
import type { Tool } from "../domain/tool";
import type { FiscalSettings, NfseRecord, ServiceCompletion } from "../domain/fiscal";
import { createWorkFromBudget } from "../domain/work";
import { defaultSettings } from "../domain/settings";
import { generateBudgetPdf } from "../services/budget-pdf";
import { calculatePricing } from "../services/pricing";
import { generateOrderPdf } from "../services/order-pdf";
import { BudgetForm } from "./BudgetForm";
import { BudgetsView, type BudgetStatusFilter } from "./BudgetsView";
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
import { ProductsView } from "./ProductsView";
import { ToolsView, type ToolFilter } from "./ToolsView";
import { SystemIcon } from "./SystemIcon";
import { OnboardingView } from "./OnboardingView";
import { AdminSetupView, LoginView } from "./AuthViews";
import type { ApprovalPaymentPlan } from "./BudgetApprovalDialog";

type View = "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "products" | "tools" | "documents" | "finance" | "cashflow" | "financing" | "folder" | "settings";
type SearchResult = { client: Client; detail: string };
type NotificationTone = "warning" | "danger" | "info";
type AppNotification = { id: string; title: string; text: string; view: View; tone: NotificationTone };
type SystemUpdateStatus = {
  status: "development" | "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string[];
  progress: number;
  message: string;
  enabled: boolean;
};
type Company = { id: string; legalName: string; tradeName: string };
type AppUser = { id: string; companyId: string; username: string; displayName: string; role: "super_admin" | "admin" | "financeiro" | "operacional" | "visualizador"; permissions: string[]; active: boolean };
type LicenseStatus = { state: string; active: boolean; message: string; expiresAt?: string; planCode?: string | null; remainingDays?: number };

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}

const viewPermissions: Record<View, string> = {
  dashboard: "dashboard.view", clients: "clients.manage", budgets: "budgets.manage", works: "works.manage", professionals: "professionals.manage", suppliers: "suppliers.manage", products: "products.manage", tools: "tools.manage", documents: "documents.manage", finance: "finance.manage", cashflow: "cashflow.manage", financing: "financing.manage", folder: "clients.manage", settings: "settings.manage"
};

export function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [sheets, setSheets] = useState<FinancialSheet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [financings, setFinancings] = useState<Financing[]>([]);
  const [openedFinancingId, setOpenedFinancingId] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [documents, setDocuments] = useState<NexusDocument[]>([]);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings | null>(null);
  const [serviceCompletions, setServiceCompletions] = useState<ServiceCompletion[]>([]);
  const [nfseRecords, setNfseRecords] = useState<NfseRecord[]>([]);
  const [nfseDrafts, setNfseDrafts] = useState<any[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<BudgetStatusFilter>("Todos");
  const [workStatusFilter, setWorkStatusFilter] = useState<"Todos" | WorkStatus>("Todos");
  const [toolFilter, setToolFilter] = useState<ToolFilter>("Todos");
  const [cashFlowFilters, setCashFlowFilters] = useState<{ kind: "all" | LedgerKind; status: "all" | LedgerStatus }>({ kind: "all", status: "all" });
  const [folderClientId, setFolderClientId] = useState<string | null>(null);
  const [folderBudgetId, setFolderBudgetId] = useState<string | null>(null);
  const [budgetClientId, setBudgetClientId] = useState<string | null>(null);
  const [budgetOrder, setBudgetOrder] = useState<Order | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft | null>(null);
  const [clientForm, setClientForm] = useState(false);
  const [orderForm, setOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [systemUpdate, setSystemUpdate] = useState<SystemUpdateStatus | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [auth, setAuth] = useState<{ hasUsers: boolean; user: AppUser | null; license: LicenseStatus } | null>(null);

  const loadSnapshot = () => window.nexusDatabase?.snapshot().then((snapshot) => {
    setCompanies(snapshot.companies); setActiveCompany(snapshot.activeCompany);
    setClients(snapshot.clients); setBudgets(snapshot.budgets); setFiles(snapshot.clientFiles);
    setSheets(snapshot.financialSheets); setOrders(snapshot.orders); setWorks(snapshot.works); setFinancings(snapshot.financings); setLedgerEntries(snapshot.ledgerEntries); setProfessionals(snapshot.professionals); setWorkDays(snapshot.workDays); setSuppliers(snapshot.suppliers); setPurchases(snapshot.purchases); setProducts(snapshot.products); setTools(snapshot.tools); setDocuments(snapshot.documents); setFiscalSettings(snapshot.fiscalSettings); setServiceCompletions(snapshot.serviceCompletions); setNfseDrafts(snapshot.nfseDrafts as any[]); setNfseRecords(snapshot.nfseRecords); setSettings({ ...defaultSettings, ...(snapshot.settings ?? {}) }); setDataLoaded(true);
  }).catch((error) => { console.error("Não foi possível carregar o banco local.", error); setDataLoaded(true); });

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [publicData, status] = await Promise.all([window.nexusDatabase?.bootstrap(), window.nexusAuth?.status()]);
        if (publicData) { setActiveCompany(publicData.activeCompany); setSettings({ ...defaultSettings, ...(publicData.settings ?? {}) }); }
        if (status) {
          setAuth({ hasUsers: status.hasUsers, user: status.user, license: status.license });
          if (status.user && status.license.active) await loadSnapshot();
          else setDataLoaded(true);
        } else setDataLoaded(true);
      } catch (error) { console.error("Não foi possível preparar o acesso ao sistema.", error); setDataLoaded(true); }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    const closeFloatingPanels = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!notificationsRef.current?.contains(target)) setNotificationsOpen(false);
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeFloatingPanels);
    return () => document.removeEventListener("pointerdown", closeFloatingPanels);
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setSearchOpen(false);
  }, [view]);

  useEffect(() => {
    let disposed = false;
    const refreshUpdate = async (check = false) => {
      try {
        const service = window.nexusUpdates;
        if (!service) return;
        const status = check ? await service.check() : await service.status();
        if (!disposed) setSystemUpdate(status);
      } catch (error) {
        console.warn("Não foi possível consultar atualizações do sistema.", error);
      }
    };
    void refreshUpdate(true);
    const statusTimer = window.setInterval(() => { void refreshUpdate(); }, 60_000);
    const checkTimer = window.setInterval(() => { void refreshUpdate(true); }, 4 * 60 * 60_000);
    return () => { disposed = true; window.clearInterval(statusTimer); window.clearInterval(checkTimer); };
  }, []);

  const finishOnboarding = async (nextSettings: Settings, nextFiscal: FiscalSettings | null, account: { displayName: string; username: string; password: string; activationKey?: string }) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    const company = await window.nexusDatabase.createCompany({ legalName: nextSettings.companyName.trim(), tradeName: nextSettings.companySubtitle.trim() || nextSettings.companyName.trim() });
    await window.nexusDatabase.selectCompany(company.id);
    const user = await window.nexusAuth?.setupAdmin(account); if (!user) throw new Error("O serviço de autenticação não está disponível.");
    await window.nexusDatabase.saveSettings(nextSettings);
    if (nextFiscal) await window.nexusDatabase.saveFiscalSettings({ ...nextFiscal, legalName: nextFiscal.legalName || nextSettings.companyName, cnpj: nextFiscal.cnpj || nextSettings.cnpj });
    const license = account.activationKey?.trim() ? await window.nexusLicense?.activate(account.activationKey) : await window.nexusLicense?.status();
    if (!license) throw new Error("O serviço de licença não está disponível.");
    setAuth({ hasUsers: true, user, license });
    await loadSnapshot();
  };
  const login = async (username: string, password: string) => { const user = await window.nexusAuth?.login({ username, password }); if (!user) throw new Error("O serviço de autenticação não está disponível."); const license = await window.nexusLicense?.status(); if (!license) throw new Error("O serviço de licença não está disponível."); setAuth({ hasUsers: true, user, license }); await loadSnapshot(); };
  const setupExistingAdmin = async (displayName: string, username: string, password: string) => { const user = await window.nexusAuth?.setupAdmin({ displayName, username, password }); if (!user) throw new Error("O serviço de autenticação não está disponível."); const license = await window.nexusLicense?.status(); if (!license) throw new Error("O serviço de licença não está disponível."); setAuth({ hasUsers: true, user, license }); };
  const logout = async () => { await window.nexusAuth?.logout(); setAuth((current) => current ? { ...current, user: null } : current); };
  const activateLicense = async (key: string) => { const license = await window.nexusLicense?.activate(key); if (!license) throw new Error("O serviço de licença não está disponível."); setAuth((current) => current ? { ...current, license } : current); return license; };

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
  const notifications = useMemo<AppNotification[]>(() => {
    const today = localDate();
    const tomorrow = shiftDate(today, 1);
    const financingAlerts = financings.flatMap<AppNotification>((financing) => {
      const clientName = clients.find((client) => client.id === financing.clientId)?.name || "cliente não localizado";
      return financing.installments.flatMap<AppNotification>((installment) => {
        if (installment.paidAt) return [];
        const due = displayDate(installment.dueDate);
        if (installment.dueDate < today) return [{ id: `financing-overdue-${financing.id}-${installment.number}`, title: "Parcela de financiamento vencida", text: `A parcela ${installment.number} de ${clientName} está vencida desde ${due}. Registre o recebimento para remover este alerta.`, view: "financing" as View, tone: "danger" as const }];
        if (installment.dueDate === today) return [{ id: `financing-today-${financing.id}-${installment.number}`, title: "Recebimento vence hoje", text: `A parcela ${installment.number} de ${clientName} vence hoje, ${due}. O alerta permanecerá até o recebimento ser registrado.`, view: "financing" as View, tone: "danger" as const }];
        if (installment.dueDate === tomorrow) return [{ id: `financing-tomorrow-${financing.id}-${installment.number}`, title: "Recebimento amanhã", text: `A parcela ${installment.number} de ${clientName} vence amanhã, ${due}.`, view: "financing" as View, tone: "warning" as const }];
        return [];
      });
    });
    const cashAlerts = ledgerEntries.flatMap<AppNotification>((entry) => {
      if (entry.status === "Cancelado" || balanceAmount(entry) <= 0) return [];
      const kind = entry.kind === "receivable" ? "Conta a receber" : "Conta a pagar";
      const item = entry.description || "sem descrição";
      const due = displayDate(entry.dueDate);
      if (entry.dueDate < today || currentLedgerStatus(entry, today) === "Vencido") return [{ id: `cash-overdue-${entry.id}`, title: `${kind} vencida`, text: `${kind} “${item}” está vencida desde ${due}. Registre a baixa para remover este alerta.`, view: "cashflow" as View, tone: "danger" as const }];
      if (entry.dueDate === today) return [{ id: `cash-today-${entry.id}`, title: `${kind} vence hoje`, text: `${kind} “${item}” vence hoje, ${due}. O alerta permanecerá até ser marcada como paga ou recebida.`, view: "cashflow" as View, tone: "danger" as const }];
      if (entry.dueDate === tomorrow) return [{ id: `cash-tomorrow-${entry.id}`, title: `${kind} amanhã`, text: `${kind} “${item}” vence amanhã, ${due}.`, view: "cashflow" as View, tone: "warning" as const }];
      return [];
    });
    const toolAlerts = tools.filter((tool) => tool.status === "Em uso" && Boolean(tool.assignment?.expectedReturnDate) && tool.assignment!.expectedReturnDate < today).map((tool) => ({ id: "tool-" + tool.id, title: "Ferramenta com devolução atrasada", text: `Ferramenta ${tool.name} não retornou na data prevista.`, view: "tools" as View, tone: "warning" as const }));
    const stockAlerts = products.filter((product) => (Number(product.stockQuantity) || 0) <= Math.max(0, Number(product.minimumStock) || 0)).map((product) => ({ id: "product-low-stock-" + product.id, title: "Produto precisa de reposição", text: `${product.name} está com ${(Number(product.stockQuantity) || 0).toLocaleString("pt-BR")} ${product.unit} em estoque; mínimo definido: ${Math.max(0, Number(product.minimumStock) || 0).toLocaleString("pt-BR")} ${product.unit}.`, view: "products" as View, tone: "warning" as const }));
    const updateAlerts = systemUpdate && ["available", "downloading", "downloaded"].includes(systemUpdate.status) ? [{ id: `system-update-${systemUpdate.availableVersion || systemUpdate.status}`, title: systemUpdate.status === "downloaded" ? "Atualização pronta para instalar" : "Nova atualização disponível", text: systemUpdate.status === "downloaded" ? `A versão ${systemUpdate.availableVersion || "nova"} já foi baixada. Reinicie o Nexus para concluir a instalação.` : `A versão ${systemUpdate.availableVersion || "nova"} do Nexus está disponível para baixar.`, view: "settings" as View, tone: "info" as const }] : [];
    return [...financingAlerts, ...cashAlerts, ...stockAlerts, ...updateAlerts, ...toolAlerts];
  }, [clients, financings, ledgerEntries, products, systemUpdate, tools]);
  const onboardingPreview = new URLSearchParams(window.location.search).has("onboardingPreview");

  if (!dataLoaded) return <div className="flex h-screen items-center justify-center bg-slate-950 text-sm text-white">Carregando Nexus...</div>;
  if (onboardingPreview) return <OnboardingView initialSettings={settings} initialFiscalSettings={fiscalSettings} previewMode onFinish={async () => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }} />;
  if (!activeCompany) return <OnboardingView onFinish={finishOnboarding} />;
  if (!auth) return <div className="flex h-screen items-center justify-center bg-slate-950 text-sm text-white">Preparando acesso seguro...</div>;
  if (!auth.hasUsers) return <AdminSetupView onSave={setupExistingAdmin} />;
  if (!auth.user) return <LoginView onLogin={login} settings={settings} license={auth.license} onActivateLicense={activateLicense} />;
  const currentUser = auth.user;

  const openFolder = (clientOrId: Client | string) => {
    setSearchQuery("");
    setSearchOpen(false);
    setFolderBudgetId(null);
    setFolderClientId(typeof clientOrId === "string" ? clientOrId : clientOrId.id);
    setView("folder");
  };
  const openBudgetInFolder = (budget: Budget) => {
    setSearchQuery("");
    setSearchOpen(false);
    setFolderClientId(budget.clientId);
    setFolderBudgetId(budget.id);
    setView("folder");
  };
  const openDashboardCashflow = (kind: "all" | LedgerKind) => {
    setCashFlowFilters({ kind, status: "all" });
    setView("cashflow");
  };
  const openSearchResult = (result: SearchResult) => {
    openFolder(result.client);
    setSearchQuery("");
    setSearchOpen(false);
  };
  const persist = (entity: "clients" | "budgets" | "financial_sheets" | "orders" | "client_files" | "works" | "ledger_entries" | "professionals" | "suppliers" | "products" | "tools" | "documents", record: unknown) => { window.nexusDatabase?.save(entity, record).catch((error) => console.error("Falha ao gravar no banco local.", error)); };
  const addClient = (client: Client) => { setClients((current) => [...current.filter((item) => item.id !== client.id), client].sort((a, b) => a.name.localeCompare(b.name))); persist("clients", client); setClientForm(false); };
  const addBudget = (budget: Budget) => { const stored = { ...budget, number: budget.number ?? String(budgets.filter((item) => !item.id.startsWith("dolibarr-budget-")).length + 1).padStart(2, "0"), pricingSnapshot: budget.pricingSnapshot ?? { icmsRate: settings.icmsRate, stateRate: settings.stateRate, federalRate: settings.federalRate, companyProfitRate: settings.companyProfitRate, applyTaxes: true, applyProfit: true, capturedAt: new Date().toISOString() } }; setBudgets((current) => [stored, ...current.filter((item) => item.id !== stored.id)]); persist("budgets", stored); setBudgetClientId(null); setBudgetOrder(null); setEditingBudget(null); setBudgetDraft(null); };
  const createBudgetFromItems = (source: Budget, items: BudgetItem[]) => {
    const base = emptyBudgetDraft();
    setBudgetDraft({ ...base, clientId: source.clientId, title: `${source.title} — itens selecionados`, description: source.description, workAddress: source.workAddress, companyName: source.companyName, companyDocument: source.companyDocument, companyCity: source.companyCity, items: items.map((item) => ({ ...item, id: crypto.randomUUID() })), estimatedExpenses: [], paymentMethod: source.paymentMethod, executionPeriod: source.executionPeriod, pricingSnapshot: source.pricingSnapshot, status: "Rascunho" });
    setEditingBudget(null);
    setBudgetOrder(null);
    setBudgetClientId(source.clientId);
  };
  const deleteBudget = async (budget: Budget) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    await window.nexusDatabase.deleteBudget(budget.id);
    setFolderBudgetId(null);
    await loadSnapshot();
  };
  const addOrder = (order: Order) => { setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]); persist("orders", order); setOrderForm(false); setEditingOrder(null); };
  const deleteOrder = async (orderId: string) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); await window.nexusDatabase.deleteOrder(orderId); setOrders((current) => current.filter((item) => item.id !== orderId)); };
  const addWork = (work: Work) => { setWorks((current) => [work, ...current.filter((item) => item.id !== work.id)]); persist("works", work); };
  const addFinancing = async (financing: Financing) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); const saved = await window.nexusDatabase.saveFinancing(financing); setFinancings((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); };
  const removeFinancing = async (financingId: string) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); await window.nexusDatabase.deleteFinancing(financingId); setFinancings((current) => current.filter((item) => item.id !== financingId)); };
  const addLedgerEntry = (entry: LedgerEntry) => { setLedgerEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]); persist("ledger_entries", entry); };
  const registerBudgetProductStock = (budget: Budget) => {
    const quantities = new Map<string, number>();
    budget.items.forEach((item) => {
      if (item.kind !== "product" || !item.productId) return;
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + Math.max(0, Number(item.quantity) || 0));
    });
    if (!quantities.size) return;
    const now = new Date().toISOString();
    const linkedWork = works.find((work) => work.budgetId === budget.id);
    const changed: Product[] = [];
    const nextProducts = products.map((product) => {
      const requested = quantities.get(product.id);
      if (!requested || product.stockHistory?.some((movement) => movement.type === "Saída por orçamento aprovado" && movement.budgetId === budget.id)) return product;
      const previousQuantity = Math.max(0, Number(product.stockQuantity) || 0);
      const actualOutput = Math.min(previousQuantity, requested);
      const resultingQuantity = previousQuantity - actualOutput;
      const movement: ProductStockMovement = {
        id: crypto.randomUUID(), type: "Saída por orçamento aprovado", quantity: -actualOutput, previousQuantity, resultingQuantity, happenedAt: now,
        clientId: budget.clientId, workId: linkedWork?.id, budgetId: budget.id,
        notes: actualOutput < requested ? `Orçamento aprovado solicitou ${requested.toLocaleString("pt-BR")} ${product.unit}; o estoque disponível foi totalmente baixado.` : `Baixa automática do orçamento ${budget.number || budget.id}.`
      };
      const updated = { ...product, stockQuantity: resultingQuantity, stockHistory: [movement, ...(product.stockHistory ?? [])], updatedAt: now };
      changed.push(updated);
      return updated;
    });
    if (!changed.length) return;
    setProducts(nextProducts);
    changed.forEach((product) => persist("products", product));
  };
  const approveBudget = (budget: Budget, plan: ApprovalPaymentPlan) => {
    const now = new Date().toISOString();
    const total = calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue;
    const remaining = Math.max(0, total - plan.entryAmount);
    const alreadyCreated = ledgerEntries.some((entry) => entry.budgetId === budget.id && entry.notes === "Gerado na aprovação do orçamento.");
    addBudget({ ...budget, status: "Aprovado" });
    registerBudgetProductStock(budget);
    if (alreadyCreated) return;
    if (plan.entryAmount > 0) {
      const receivedOn = plan.entryReceivedOn || now.slice(0, 10);
      addLedgerEntry({ id: crypto.randomUUID(), kind: "receivable", description: `Entrada — ${budget.title}`, category: "Outros", totalAmount: plan.entryAmount, issueDate: receivedOn, dueDate: receivedOn, clientId: budget.clientId, budgetId: budget.id, supplierName: "", paymentMethod: "Pix", status: "Pago", notes: "Gerado na aprovação do orçamento.", payments: [{ id: crypto.randomUUID(), date: receivedOn, amount: plan.entryAmount, method: "Pix", discount: 0, interest: 0, notes: "Entrada registrada na aprovação do orçamento.", createdAt: now }], createdAt: now, updatedAt: now });
    }
    if (remaining > 0) {
      const dueOn = plan.remainingDueOn || now.slice(0, 10);
      addLedgerEntry({ id: crypto.randomUUID(), kind: "receivable", description: `Saldo do orçamento — ${budget.title}`, category: "Outros", totalAmount: remaining, issueDate: now.slice(0, 10), dueDate: dueOn, clientId: budget.clientId, budgetId: budget.id, supplierName: "", paymentMethod: "Pix", status: "Pendente", notes: "Gerado na aprovação do orçamento.", payments: [], createdAt: now, updatedAt: now });
    }
  };
  const deleteLedgerEntry = async (entryId: string) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    await window.nexusDatabase.deleteLedgerEntry(entryId);
    setLedgerEntries((current) => current.filter((item) => item.id !== entryId));
  };
  const addProfessional = (professional: Professional) => { setProfessionals((current) => [...current.filter((item) => item.id !== professional.id), professional].sort((a, b) => a.name.localeCompare(b.name))); persist("professionals", professional); };
  const addWorkDay = async (day: WorkDay) => {
    if (!window.nexusDatabase) throw new Error("O banco local não está disponível.");
    const saved = await window.nexusDatabase.saveWorkDay(day);
    setWorkDays((current) => [saved.day, ...current.filter((item) => item.id !== saved.day.id)]);
    setSheets((current) => [saved.financialSheet, ...current.filter((item) => item.id !== saved.financialSheet.id)]);
  };
  const addSupplier = (supplier: Supplier) => { setSuppliers((current) => [...current.filter((item) => item.id !== supplier.id), supplier].sort((a, b) => a.name.localeCompare(b.name))); persist("suppliers", supplier); };
  const addProduct = (product: Product) => { setProducts((current) => [...current.filter((item) => item.id !== product.id), product].sort((a, b) => a.name.localeCompare(b.name))); persist("products", product); };
  const addTool = (tool: Tool) => { setTools((current) => [...current.filter((item) => item.id !== tool.id), tool].sort((a, b) => a.name.localeCompare(b.name))); persist("tools", tool); };
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
  const nav = (target: "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "products" | "tools" | "documents" | "finance" | "cashflow" | "financing" | "settings") => "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm " + (view === target ? "bg-nexus-primary font-semibold text-white shadow-sm" : "text-slate-200 hover:bg-slate-800");
  const canManageView = (target: View) => currentUser.role === "super_admin" || currentUser.permissions.includes("*") || currentUser.permissions.includes(viewPermissions[target]);
  const readOnlyView = !canManageView(view);
  const logo = settings.appLogoDataUrl || settings.logoDataUrl;
  const hasHeaderText = settings.showHeaderText;
  const direction = hasHeaderText && settings.headerLayout === "row" ? "flex-row gap-3" : "flex-col";

  const pageTitles: Record<View, string> = { dashboard: "Dashboard", clients: "Clientes", budgets: "Orçamentos", works: "Obras", professionals: "Profissionais", suppliers: "Fornecedores", products: "Produtos", tools: "Ferramentas", documents: "Documentos", finance: "Financeiro", cashflow: "Fluxo de caixa", financing: "Financiamento", folder: "Pasta do cliente", settings: "Configurações" };
  const pageIcons: Record<View, "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "products" | "tools" | "documents" | "finance" | "cashflow" | "financing" | "settings"> = { dashboard: "dashboard", clients: "clients", budgets: "budgets", works: "works", professionals: "professionals", suppliers: "suppliers", products: "products", tools: "tools", documents: "documents", finance: "finance", cashflow: "cashflow", financing: "financing", folder: "clients", settings: "settings" };
  const themeStyle = settings.customThemeEnabled ? { "--nexus-brand-primary": settings.themeButtonColor, "--nexus-brand-sidebar": settings.themeSidebarColor, "--nexus-brand-text": settings.themeTextColor } as CSSProperties : undefined;
  return <div style={themeStyle} className={(settings.customThemeEnabled ? "theme-custom " : "") + "flex h-screen overflow-hidden bg-slate-50"}>
    <aside className="flex w-52 shrink-0 flex-col bg-nexus-ink px-3 py-4 text-white">
      <div className={"flex " + direction + " items-center border-b border-slate-700 pb-4"}>
        {logo ? <img src={logo} style={{ width: settings.appLogoSize, height: settings.appLogoSize }} className="object-contain" /> : <div style={{ width: settings.appLogoSize, height: settings.appLogoSize }} className="flex items-center justify-center rounded bg-nexus-primary text-2xl font-bold">N</div>}
        {hasHeaderText && <div>
<b className="text-lg">{settings.companyName}</b>
<p className="text-[10px] tracking-widest text-slate-300">{settings.companySubtitle}</p>
</div>}
      </div>
      <nav className="mt-5 space-y-1">
        <button title={canManageView("dashboard") ? "" : "Somente visualização"} className={nav("dashboard")}
onClick={() => setView("dashboard")}>
<SystemIcon name="dashboard" className="h-5 w-5"/>Dashboard{!canManageView("dashboard") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("clients") ? "" : "Somente visualização"} className={nav("clients")}
onClick={() => setView("clients")}>
<SystemIcon name="clients" className="h-5 w-5"/>Clientes{!canManageView("clients") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("budgets") ? "" : "Somente visualização"} className={nav("budgets")}
onClick={() => { setBudgetStatusFilter("Todos"); setView("budgets"); }}>
<SystemIcon name="budgets" className="h-5 w-5"/>Orçamentos{!canManageView("budgets") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("works") ? "" : "Somente visualização"} className={nav("works")}
onClick={() => { setWorkStatusFilter("Todos"); setView("works"); }}>
<SystemIcon name="works" className="h-5 w-5"/>Obras{!canManageView("works") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("professionals") ? "" : "Somente visualização"} className={nav("professionals")}
onClick={() => setView("professionals")}>
<SystemIcon name="professionals" className="h-5 w-5"/>Profissionais{!canManageView("professionals") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("suppliers") ? "" : "Somente visualização"} className={nav("suppliers")}
onClick={() => setView("suppliers")}>
<SystemIcon name="suppliers" className="h-5 w-5"/>Fornecedores{!canManageView("suppliers") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("products") ? "" : "Somente visualização"} className={nav("products")}
onClick={() => setView("products")}>
<SystemIcon name="products" className="h-5 w-5"/>Produtos{!canManageView("products") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("tools") ? "" : "Somente visualização"} className={nav("tools")}
onClick={() => { setToolFilter("Todos"); setView("tools"); }}>
<SystemIcon name="tools" className="h-5 w-5"/>Ferramentas{!canManageView("tools") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("documents") ? "" : "Somente visualização"} className={nav("documents")}
onClick={() => setView("documents")}>
<SystemIcon name="documents" className="h-5 w-5"/>Documentos{!canManageView("documents") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("finance") ? "" : "Somente visualização"} className={nav("finance")}
onClick={() => setView("finance")}>
<SystemIcon name="finance" className="h-5 w-5"/>Financeiro{!canManageView("finance") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("cashflow") ? "" : "Somente visualização"} className={nav("cashflow")}
onClick={() => { setCashFlowFilters({ kind: "all", status: "all" }); setView("cashflow"); }}>
<SystemIcon name="cashflow" className="h-5 w-5"/>Fluxo de caixa{!canManageView("cashflow") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("financing") ? "" : "Somente visualização"} className={nav("financing")}
onClick={() => { setOpenedFinancingId(null); setView("financing"); }}>
<SystemIcon name="financing" className="h-5 w-5"/>Financiamento{!canManageView("financing") && <span className="ml-auto text-xs">🔒</span>}</button>
        <button title={canManageView("settings") ? "" : "Somente visualização"} className={nav("settings")}
onClick={() => setView("settings")}>
<SystemIcon name="settings" className="h-5 w-5"/>Configurações{!canManageView("settings") && <span className="ml-auto text-xs">🔒</span>}</button>
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
<option value="">Selecionar empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.tradeName}</option>)}</select>}<div ref={notificationsRef} className="relative"><button type="button" aria-label="Notificações" title="Notificações" onClick={() => setNotificationsOpen((open) => !open)} className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-nexus-primary bg-nexus-primary text-xl text-white shadow-sm hover:bg-orange-600">🔔{notifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[10px] font-bold text-nexus-primary">{notifications.length > 9 ? "9+" : notifications.length}</span>}</button>{notificationsOpen && <div className="absolute left-0 z-40 mt-2 max-h-[min(32rem,calc(100vh-7rem))] w-96 overflow-y-auto rounded-xl border border-nexus-border bg-white shadow-xl"><div className="sticky top-0 border-b bg-white px-4 py-3 text-sm font-semibold">Notificações</div>{notifications.length ? notifications.map((notification) => { const styles = notification.tone === "danger" ? "border-l-4 border-l-red-500 bg-red-50 hover:bg-red-100" : notification.tone === "warning" ? "border-l-4 border-l-amber-400 bg-amber-50 hover:bg-amber-100" : "border-l-4 border-l-blue-500 bg-blue-50 hover:bg-blue-100"; const title = notification.tone === "danger" ? `Urgente · ${notification.title}` : notification.title; return <button className={"block w-full border-b px-4 py-3 text-left text-sm " + styles} key={notification.id} onClick={() => { setView(notification.view); setNotificationsOpen(false); }}><b className={"block " + (notification.tone === "danger" ? "text-red-800" : "text-nexus-ink")}>{title}</b><span className={notification.tone === "danger" ? "text-red-700" : "text-nexus-muted"}>{notification.text}</span></button>; }) : <p className="px-4 py-5 text-sm text-nexus-muted">Nenhuma notificação pendente.</p>}</div>}</div><div ref={searchRef}>{!searchOpen ? <button type="button"
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
</div>}</div></div>
      </div>
      <section aria-disabled={readOnlyView} className={readOnlyView ? "pointer-events-none select-none opacity-75" : ""} onKeyDownCapture={readOnlyView ? (event) => event.preventDefault() : undefined}>
      {readOnlyView && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">🔒 Modo somente visualização: sua conta não possui permissão para alterar esta área.</div>}
      {view === "dashboard" && <DashboardView budgets={budgets} clients={clients} sheets={sheets} settings={settings} works={works} ledgerEntries={ledgerEntries} tools={tools} professionals={professionals} financings={financings}
onOpenApprovedBudgets={() => { setBudgetStatusFilter("Aprovado"); setView("budgets"); }}
onOpenOpenBudgets={() => { setBudgetStatusFilter("Aberto"); setView("budgets"); }}
onOpenRejectedBudgets={() => { setBudgetStatusFilter("Não aprovado"); setView("budgets"); }}
onOpenClients={() => setView("clients")}
onOpenCashflow={openDashboardCashflow}
onOpenFinance={() => setView("finance")}
onOpenWorksInProgress={() => { setWorkStatusFilter("Em execução"); setView("works"); }}
onOpenToolsInUse={() => { setToolFilter("Em uso"); setView("tools"); }}
onOpenProfessionals={() => setView("professionals")}
onOpenFinancing={() => { setOpenedFinancingId(null); setView("financing"); }} />}
      {view === "clients" && <ClientsView clients={clients}
onNewClient={() => setClientForm(true)}
onOpenFolder={openFolder}
onToggleActive={(client) => addClient({ ...client, active: client.active === false })} />}
      {view === "budgets" && <BudgetsView budgets={budgets} orders={orders} works={works} clients={clients} settings={settings} fiscalSettings={fiscalSettings} serviceCompletions={serviceCompletions} nfseDrafts={nfseDrafts} nfseRecords={nfseRecords} initialStatusFilter={budgetStatusFilter}
onSaveNfseDraft={async (budgetId, draft) => { const saved = await window.nexusDatabase?.saveFiscalDraft(budgetId, draft); setNfseDrafts((current) => [saved, ...current.filter((item) => item?.budgetId !== budgetId)]); }}
onConfirmService={confirmService}
onPrepareNfse={prepareNfse}
onNewBudget={() => { setBudgetDraft(null); setBudgetClientId(""); }}
onNewOrder={() => { setEditingOrder(null); setOrderForm(true); }}
onEditOrder={(order) => { setEditingOrder(order); setOrderForm(true); }}
onDeleteOrder={deleteOrder}
onEditBudget={(budget) => { setBudgetDraft(null); setEditingBudget(budget); setBudgetClientId(budget.clientId); }}
onCreateBudgetFromOrder={(order) => { setBudgetDraft(null); setBudgetOrder(order); setBudgetClientId(order.clientId); }}
onCreateWork={createWork}
onOpenFolder={openFolder}
onOpenBudgetInFolder={openBudgetInFolder}
onPdf={generateBudgetPdf}
onOrderPdf={generateOrderPdf} />}
      {view === "works" && <WorksView works={works} clients={clients} budgets={budgets} professionals={professionals} initialStatusFilter={workStatusFilter}
onSave={addWork} onCreateWork={createWork} />}
      {view === "professionals" && <ProfessionalsView professionals={professionals} workDays={workDays} works={works} clients={clients}
onSaveProfessional={addProfessional}
onSaveWorkDay={addWorkDay} />}
      {view === "suppliers" && <SuppliersView suppliers={suppliers} purchases={purchases} works={works}
onSaveSupplier={addSupplier}
onSavePurchase={addPurchase} />}
      {view === "products" && <ProductsView products={products} clients={clients} works={works} onSave={addProduct} />}
      {view === "tools" && <ToolsView tools={tools} professionals={professionals} works={works} budgets={budgets} initialFilter={toolFilter} onSave={addTool} />}
      {view === "documents" && <DocumentsView documents={documents} clients={clients} budgets={budgets} works={works} settings={settings}
onSave={addDocument} />}
      {view === "finance" && <FinanceView clients={clients} budgets={budgets} sheets={sheets} settings={settings}
works={works} professionals={professionals}
onSave={(sheet) => { setSheets((current) => [sheet, ...current.filter((item) => item.id !== sheet.id)]); persist("financial_sheets", sheet); }}
onDelete={async (sheetId) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); await window.nexusDatabase.deleteFinancialSheet(sheetId); setSheets((current) => current.filter((sheet) => sheet.id !== sheetId)); }} />}
      {view === "cashflow" && <CashFlowView entries={ledgerEntries} clients={clients} works={works} budgets={budgets} financings={financings}
settings={settings} initialKindFilter={cashFlowFilters.kind} initialStatusFilter={cashFlowFilters.status} onSave={addLedgerEntry} onDelete={deleteLedgerEntry} onOpenFinancing={(financingId) => { setOpenedFinancingId(financingId); setView("financing"); }} />}
      {view === "financing" && <FinancingView clients={clients} works={works} budgets={budgets} financings={financings} settings={settings} openFinancingId={openedFinancingId} onSave={addFinancing} onDelete={removeFinancing} onOpenBudget={openBudgetInFolder} />}
      {view === "folder" && activeClient && <ClientFolder client={activeClient} budgets={budgets.filter((item) => item.clientId === activeClient.id)} files={files.filter((item) => item.clientId === activeClient.id)} financings={financings} works={works} sheets={sheets} settings={settings}
initialBudgetId={folderBudgetId}
onInitialBudgetOpened={() => setFolderBudgetId(null)}
onBack={() => { setFolderBudgetId(null); setView("clients"); }}
onNewBudget={() => { setBudgetDraft(null); setBudgetClientId(activeClient.id); }}
onEditBudget={(budget) => { setBudgetDraft(null); setEditingBudget(budget); setBudgetClientId(budget.clientId); }}
onCreateBudgetFromItems={createBudgetFromItems}
onCreateWork={createWork}
onUpdateBudget={addBudget}
onApproveBudget={approveBudget}
onUpdateClient={addClient}
onDeleteBudget={deleteBudget}
onOpenFinancing={(financingId) => { setOpenedFinancingId(financingId); setView("financing"); }}
onUpload={upload} />}
      {view === "settings" && <>
<SettingsView initial={settings} fiscalSettings={fiscalSettings} currentUser={auth.user} license={auth.license} onActivateLicense={activateLicense}
onSaveFiscal={saveFiscalSettings}
onSave={async (next) => { if (!window.nexusDatabase) throw new Error("O banco local não está disponível."); await window.nexusDatabase.saveSettings(next); setSettings(next); }}
onLogout={logout}
onUpdateAccount={async (details) => { const user = await window.nexusAuth?.updateAccount(details); if (!user) throw new Error("Não foi possível atualizar a conta."); setAuth((current) => ({ hasUsers: true, user, license: current?.license ?? { state: "missing", active: false, message: "Licença indisponível." } })); }} />
</>}
      </section>
    </main>
    {clientForm && <ClientForm
onCancel={() => setClientForm(false)}
onSave={addClient} />}
    {orderForm && <OrderForm clients={clients} professionals={professionals} initialOrder={editingOrder ?? undefined}
onCancel={() => { setOrderForm(false); setEditingOrder(null); }}
onSave={addOrder}
onClientCreated={addClient}
onClientUpdated={addClient} />}
    {budgetClientId !== null && <BudgetForm key={editingBudget?.id || budgetOrder?.id || budgetDraft?.items.map((item) => item.id).join("-") || budgetClientId} clients={clients} professionals={professionals} purchases={purchases} products={products} settings={settings} initialClientId={budgetClientId} initialOrder={budgetOrder ?? undefined} initialBudget={editingBudget ?? undefined} initialDraft={budgetDraft ?? undefined}
onCancel={() => { setBudgetClientId(null); setBudgetOrder(null); setEditingBudget(null); setBudgetDraft(null); }}
onSave={addBudget}
onApproveBudget={approveBudget}
onClientCreated={addClient}
onClientUpdated={addClient} />}
  </div>;
}

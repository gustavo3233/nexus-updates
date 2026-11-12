import type { ClientFile } from "../domain/client-file";
import type { FiscalSettings, NfseAttempt, NfseRecord, ServiceCompletion } from "../domain/fiscal";

declare global {
  interface Window {
    nexusDocuments?: {
      selectAndSave(clientId: string): Promise<Omit<ClientFile, "id" | "category" | "createdAt"> | null>;
      importDolibarr(): Promise<{
        clients: Array<{ sourceId: number; name: string; address: string; phone: string; email: string; document: string; createdAt: string }>;
        budgets: Array<{ sourceId: number; clientSourceId: number; title: string; description: string; issueDate: string; validUntil: string | null; status: number; total: number; createdAt: string; items: Array<{ id: number; description: string; quantity: number; unitPrice: number; icmsRate: number; issRate: number }> }>;
        files: Array<{ sourceId: number; clientSourceId: number; filename: string; createdAt: string; localPath: string; category: ClientFile["category"] }>;
      }>;
    };
    nexusExternal?: {
      openWhatsAppWeb(phone: string): Promise<boolean>;
      openEmailCompose(recipient: string, subject: string, body: string): Promise<boolean>;
    };
    nexusAuth?: {
      status(): Promise<{ hasUsers: boolean; activeCompany: Company | null; user: AppUser | null; license: LicenseStatus }>;
      setupAdmin(details: { username: string; password: string; displayName?: string }): Promise<AppUser>;
      login(details: { username: string; password: string }): Promise<AppUser>;
      logout(): Promise<boolean>;
      updateAccount(details: { username?: string; password?: string; displayName?: string }): Promise<AppUser>;
      users(): Promise<AppUser[]>;
      createUser(details: { username: string; password: string; displayName?: string; role?: AppUser["role"]; permissions?: string[] }): Promise<AppUser>;
      updateUser(userId: string, details: { username?: string; password?: string; displayName?: string; role?: AppUser["role"]; permissions?: string[]; active?: boolean }): Promise<AppUser>;
    };
    nexusLicense?: {
      status(): Promise<LicenseStatus>;
      activate(key: string): Promise<LicenseStatus>;
    };
    nexusUpdates?: {
      status(): Promise<UpdateStatus>;
      check(): Promise<UpdateStatus>;
      download(): Promise<UpdateStatus>;
      install(): Promise<void>;
    };
    nexusDatabase?: {
      bootstrap(): Promise<{ activeCompany: Company | null; settings: import("../domain/settings").Settings | null }>;
      snapshot(): Promise<{ activeCompany: Company | null; companies: Company[]; clients: import("../domain/client").Client[]; budgets: import("../domain/budget").Budget[]; financialSheets: import("../domain/financial-sheet").FinancialSheet[]; orders: import("../domain/order").Order[]; clientFiles: import("../domain/client-file").ClientFile[]; works: import("../domain/work").Work[]; financings: import("../domain/financing").Financing[]; ledgerEntries: import("../domain/ledger").LedgerEntry[]; professionals: import("../domain/professional").Professional[]; workDays: import("../domain/professional").WorkDay[]; suppliers: import("../domain/supplier").Supplier[]; purchases: import("../domain/supplier").Purchase[]; products: import("../domain/product").Product[]; tools: import("../domain/tool").Tool[]; documents: import("../domain/document").NexusDocument[]; serviceCompletions: ServiceCompletion[]; nfseDrafts: unknown[]; nfseRecords: NfseRecord[]; nfseAttempts: NfseAttempt[]; fiscalSettings: FiscalSettings | null; settings: import("../domain/settings").Settings | null }>;
      companies(): Promise<Company[]>;
      createCompany(company: Pick<Company, "legalName" | "tradeName">): Promise<Company>;
      selectCompany(companyId: string): Promise<unknown>;
      save(entity: "clients" | "budgets" | "financial_sheets" | "orders" | "client_files" | "works" | "ledger_entries" | "professionals" | "suppliers" | "products" | "tools" | "documents", record: unknown): Promise<unknown>;
      deleteLedgerEntry(entryId: string): Promise<boolean>;
      deleteFinancialSheet(sheetId: string): Promise<boolean>;
      deleteBudget(budgetId: string): Promise<{ works: number; financialSheets: number; documents: number; ledgerEntries: number; workDays: number; purchases: number }>;
      deleteOrder(orderId: string): Promise<boolean>;
      saveFinancing(financing: import("../domain/financing").Financing): Promise<import("../domain/financing").Financing>;
      deleteFinancing(financingId: string): Promise<boolean>;
      saveWorkDay(day: import("../domain/professional").WorkDay): Promise<{ day: import("../domain/professional").WorkDay; financialSheet: import("../domain/financial-sheet").FinancialSheet }>;
      savePurchase(purchase: import("../domain/supplier").Purchase): Promise<{ purchase: import("../domain/supplier").Purchase; financialSheet: import("../domain/financial-sheet").FinancialSheet | null }>;
      saveSettings(settings: import("../domain/settings").Settings): Promise<unknown>;
      saveFiscalSettings(settings: FiscalSettings): Promise<FiscalSettings>;
      saveFiscalDraft(budgetId: string, draft: { title: string; serviceDescription: string; paymentDescription: string; serviceValue: number; discounts: number }): Promise<unknown>;
      importA1Certificate(details: { certificateCnpj: string; validUntil?: string }): Promise<unknown>;
      confirmService(completion: ServiceCompletion): Promise<ServiceCompletion>;
      prepareNfse(budgetId: string): Promise<{ record: NfseRecord; attempt: NfseAttempt }>;
      fiscalDiagnostics(): Promise<{ environment: { selected: string; endpoint: string; productionBlocked: boolean; networkEnabled: boolean; connectivity: string }; fiscal: { pending: string[]; valid: boolean }; xsd: { status: string; expectedVersion: string; message: string; filename?: string; sha256?: string }; certificate: { status: string; message: string }; transmission: { allowed: boolean; message: string } }>;
      status(): Promise<{ databasePath: string; legacyMigration: string | null; backup: string | null }>;
    };
  }
}

type Company = { id: string; legalName: string; tradeName: string; createdAt: string; updatedAt: string };
type AppUser = { id: string; companyId: string; username: string; displayName: string; role: "super_admin" | "admin" | "financeiro" | "operacional" | "visualizador"; permissions: string[]; active: boolean };
type UpdateStatus = { status: "development" | "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error"; currentVersion: string; availableVersion: string | null; releaseNotes: string[]; progress: number; message: string; feedUrl: string; enabled: boolean };
type LicenseStatus = { state: "onboarding" | "missing" | "trial_active" | "licensed" | "expired" | "clock_suspicious" | "invalid" | "inactive"; active: boolean; message: string; expiresAt?: string; planCode?: string | null; remainingDays?: number };

export {};

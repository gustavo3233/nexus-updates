export type BudgetStatus = "Rascunho" | "Aberto" | "Enviado" | "Aprovado" | "Não aprovado" | "Faturado";
export type BudgetItem = { id: string; description: string; quantity: number; unit: string; unitPrice: number; icmsRate: number; issRate: number; isCourtesy?: boolean; kind?: "service" | "product"; productId?: string };
export const budgetUnitOptions = [
  { value: "un", label: "Unidade (un)" }, { value: "m", label: "Metro linear (m)" },
  { value: "m²", label: "Metro quadrado (m²)" }, { value: "m³", label: "Metro cúbico (m³)" },
  { value: "kg", label: "Quilograma (kg)" }, { value: "g", label: "Grama (g)" },
  { value: "t", label: "Tonelada (t)" }, { value: "L", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" }, { value: "h", label: "Hora (h)" },
  { value: "dia", label: "Diária (dia)" }, { value: "semana", label: "Semana" },
  { value: "mês", label: "Mês" }, { value: "serviço", label: "Serviço" },
  { value: "cj", label: "Conjunto (cj)" }, { value: "cx", label: "Caixa (cx)" },
  { value: "rolo", label: "Rolo" }, { value: "par", label: "Par" }, { value: "pct", label: "Pacote (pct)" }
] as const;
export type EstimatedExpense = {
  id: string;
  category: "funcionario" | "materiais" | "ferramenta" | "logistica" | "outros";
  description: string;
  amount: number;
  professionalId?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
};
export type PricingSnapshot = { icmsRate: number; stateRate: number; federalRate: number; companyProfitRate: number; applyTaxes?: boolean; applyProfit?: boolean; capturedAt: string };
export type Budget = { id: string; number?: string; clientId: string; sourceOrderId?: string; title: string; description: string; workAddress: string; companyName: string; companyDocument: string; companyCity: string; items: BudgetItem[]; estimatedExpenses: EstimatedExpense[]; paymentMethod: string; executionPeriod: string; totalValue: number; issueDate: string; validUntil: string; observations: string; status: BudgetStatus; isCourtesy?: boolean; pricingSnapshot?: PricingSnapshot; sentAt?: string; whatsappSentAt?: string; createdAt: string };
export type BudgetDraft = Omit<Budget, "id" | "createdAt">;
export const emptyBudgetItem = (): BudgetItem => ({ id: crypto.randomUUID(), description: "", quantity: 1, unit: "un", unitPrice: 0, icmsRate: 0, issRate: 0, kind: "service" });
export const emptyBudgetDraft = (): BudgetDraft => ({ clientId: "", title: "", description: "", workAddress: "", companyName: "Nexus Construção e Reformas", companyDocument: "", companyCity: "", items: [emptyBudgetItem()], estimatedExpenses: [], paymentMethod: "", executionPeriod: "", totalValue: 0, issueDate: new Date().toISOString().slice(0, 10), validUntil: "", observations: "", status: "Rascunho", isCourtesy: false });
export function calculateBudgetTotal(items: BudgetItem[]) { return items.reduce((total, item) => total + item.quantity * item.unitPrice, 0); }
export function validateBudget(draft: BudgetDraft): string | null { if (!draft.clientId) return "Selecione ou cadastre um cliente."; if (!draft.title.trim()) return "Informe o título do orçamento."; if (!draft.workAddress.trim()) return "Informe o endereço da obra."; if (!draft.items.length || draft.items.some((item) => !item.description.trim() || item.quantity <= 0 || (!item.isCourtesy && item.unitPrice <= 0))) return "Preencha descrição e quantidade de todos os itens; informe o valor somente nos itens que não forem cortesia."; if (!draft.issueDate) return "Informe a data de emissão."; return null; }

export type ExpenseCategory = "funcionario" | "materiais" | "ferramenta" | "logistica" | "outros";

export type FinancialExpense = {
  id: string;
  sourceId?: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
};

export type FinancialSheet = {
  id: string;
  clientId: string;
  budgetId: string;
  createdAt: string;
  updatedAt: string;
  expenses: FinancialExpense[];
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  funcionario: "Funcionário",
  materiais: "Materiais",
  ferramenta: "Ferramenta",
  logistica: "Logística",
  outros: "Outros"
};

export function emptyExpense(): FinancialExpense {
  return { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), category: "funcionario", description: "", amount: 0 };
}

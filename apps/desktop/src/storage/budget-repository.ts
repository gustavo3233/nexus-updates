import type { Budget } from "../domain/budget";

const budgetsKey = "@nexus/desktop/budgets";

export function listBudgets(): Budget[] {
  const content = window.localStorage.getItem(budgetsKey);
  if (!content) return [];

  try {
    return (JSON.parse(content) as Budget[]).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  } catch {
    return [];
  }
}

export function saveBudget(budget: Budget): Budget[] {
  const budgets = [budget, ...listBudgets()];
  window.localStorage.setItem(budgetsKey, JSON.stringify(budgets));
  return budgets;
}

export function listBudgetsForClient(clientId: string): Budget[] {
  return listBudgets().filter((budget) => budget.clientId === clientId);
}

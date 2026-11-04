import type { FinancialSheet } from "../domain/financial-sheet";

const key = "@nexus/desktop/financial-sheets";

export function listFinancialSheets(): FinancialSheet[] {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as FinancialSheet[]; } catch { return []; }
}

export function saveFinancialSheet(sheet: FinancialSheet): FinancialSheet[] {
  const sheets = listFinancialSheets();
  const index = sheets.findIndex((item) => item.id === sheet.id);
  const next = index >= 0 ? sheets.map((item) => item.id === sheet.id ? sheet : item) : [sheet, ...sheets];
  window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function expensesForBudget(sheets: FinancialSheet[], budgetId: string) {
  return sheets.filter((sheet) => sheet.budgetId === budgetId).flatMap((sheet) => sheet.expenses);
}

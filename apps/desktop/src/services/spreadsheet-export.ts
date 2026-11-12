import { jsPDF } from "jspdf";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import { expenseCategoryLabels, type FinancialExpense, type FinancialSheet } from "../domain/financial-sheet";
import { calculatePricing } from "./pricing";
import type { Settings } from "../domain/settings";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const categoryColors: Record<FinancialExpense["category"], [number, number, number]> = { funcionario: [219, 234, 254], materiais: [220, 252, 231], ferramenta: [254, 243, 199], logistica: [243, 232, 255], outros: [226, 232, 240] };

function safeFilename(value: string) { return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(); }
function header(pdf: jsPDF, title: string, settings: Settings) {
  pdf.setFillColor(23, 32, 51); pdf.rect(0, 0, 297, 27, "F");
  if (settings.pdfLogoDataUrl) { try { pdf.addImage(settings.pdfLogoDataUrl, "PNG", 11, 5, 20, 16, undefined, "FAST"); } catch { /* usa cabeçalho textual */ } }
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text(settings.companyName || "Nexus Construção e Reformas", 37, 12);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(title, 37, 19);
  pdf.setTextColor(23, 32, 51);
}
function tableHeader(pdf: jsPDF, columns: string[], widths: number[], y: number) {
  let x = 10; pdf.setFillColor(23, 32, 51); pdf.rect(10, y, 277, 8, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
  columns.forEach((column, index) => { pdf.text(column, x + 2, y + 5); x += widths[index]; });
  pdf.setTextColor(23, 32, 51); return y + 8;
}
function addExpenseRows(pdf: jsPDF, entries: { expense: FinancialExpense; client?: Client; budget?: Budget }[], columns: string[], widths: number[], y: number, settings: Settings) {
  let position = y;
  for (const entry of entries) {
    if (position > 192) { pdf.addPage("a4", "landscape"); header(pdf, "Relatório financeiro", settings); position = tableHeader(pdf, columns, widths, 33); }
    const color = categoryColors[entry.expense.category]; let x = 10;
    pdf.setFillColor(...color); pdf.rect(10, position, 277, 8, "F"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    const data = entry.client ? [entry.expense.date, entry.client.name, entry.budget?.title || "Obra não localizada", expenseCategoryLabels[entry.expense.category], entry.expense.description || "—", money.format(entry.expense.amount)] : [entry.expense.date, expenseCategoryLabels[entry.expense.category], entry.expense.description || "—", money.format(entry.expense.amount)];
    data.forEach((value, index) => { pdf.text(String(value).slice(0, index === 2 ? 55 : 36), x + 2, position + 5, { maxWidth: widths[index] - 4 }); x += widths[index]; });
    position += 8;
  }
  return position;
}
function infoLine(pdf: jsPDF, label: string, value: string, x: number, y: number) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(label, x, y); pdf.setFont("helvetica", "normal"); pdf.text(value || "Não informado", x + 30, y);
}

export function generateWorkSpreadsheetPdf(client: Client, budget: Budget, sheet: FinancialSheet | undefined, settings: Settings, download = true) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const expenses = sheet?.expenses ?? []; const total = expenses.reduce((sum, item) => sum + item.amount, 0); const pricing = calculatePricing(budget.totalValue, settings, budget.pricingSnapshot);
  header(pdf, "Relatório da obra", settings);
  infoLine(pdf, "Cliente:", client.name, 12, 37); infoLine(pdf, "Documento:", client.document, 12, 44); infoLine(pdf, "Obra:", budget.title, 105, 37); infoLine(pdf, "Endereço:", budget.workAddress, 105, 44);
  infoLine(pdf, "Orçamento:", budget.id, 205, 37); infoLine(pdf, "Valor cobrado:", money.format(pricing.chargedValue), 205, 44);
  const columns = ["Data", "Categoria", "Descrição do gasto", "Valor"]; const widths = [35, 55, 140, 47];
  let y = tableHeader(pdf, columns, widths, 53);
  y = addExpenseRows(pdf, expenses.map((expense) => ({ expense })), columns, widths, y, settings);
  pdf.setFillColor(23, 32, 51); pdf.rect(10, y + 3, 277, 9, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Total de gastos reais: " + money.format(total), 190, y + 9); pdf.setTextColor(23, 32, 51);
  if (download) pdf.save("relatorio-obra-" + safeFilename(client.name + "-" + budget.title) + ".pdf");
  return pdf.output("datauristring");
}

export function exportWorkSpreadsheet(client: Client, budget: Budget, sheet: FinancialSheet | undefined, settings: Settings) {
  return generateWorkSpreadsheetPdf(client, budget, sheet, settings, true);
}

export function exportConsolidatedSpreadsheet(budgets: Budget[], clients: Client[], sheets: FinancialSheet[], settings: Settings, title: string, start?: Date) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const entries = sheets.flatMap((sheet) => sheet.expenses.filter((expense) => !start || new Date(expense.date + "T12:00:00") >= start).map((expense) => ({ expense, client: clients.find((item) => item.id === sheet.clientId), budget: budgets.find((item) => item.id === sheet.budgetId) })));
  const spent = entries.reduce((sum, item) => sum + item.expense.amount, 0); const revenue = budgets.reduce((sum, budget) => sum + calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue, 0); const taxes = budgets.reduce((sum, budget) => sum + calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).taxes, 0);
  header(pdf, "Consolidado financeiro — " + title, settings);
  infoLine(pdf, "Obras no filtro:", String(budgets.length), 12, 37); infoLine(pdf, "Faturamento:", money.format(revenue), 12, 44); infoLine(pdf, "Impostos:", money.format(taxes), 105, 37); infoLine(pdf, "Gastos:", money.format(spent), 105, 44); infoLine(pdf, "Resultado:", money.format(revenue - taxes - spent), 205, 37);
  let workY = 53;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Obras e orçamentos incluídos no filtro", 10, workY);
  workY += 4;
  const workColumns = ["Cliente", "Obra / orçamento", "Identificação", "Valor cobrado"]; const workWidths = [77, 115, 45, 40];
  workY = tableHeader(pdf, workColumns, workWidths, workY);
  for (const budget of budgets) {
    if (workY > 188) { pdf.addPage("a4", "landscape"); header(pdf, "Consolidado financeiro — " + title, settings); workY = tableHeader(pdf, workColumns, workWidths, 33); }
    let x = 10; pdf.setFillColor(248, 250, 252); pdf.rect(10, workY, 277, 8, "F"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    const data = [clients.find((client) => client.id === budget.clientId)?.name || "Cliente não localizado", budget.title, budget.id, money.format(calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue)];
    data.forEach((value, index) => { pdf.text(value.slice(0, 62), x + 2, workY + 5, { maxWidth: workWidths[index] - 4 }); x += workWidths[index]; });
    workY += 8;
  }
  if (workY > 174) { pdf.addPage("a4", "landscape"); header(pdf, "Consolidado financeiro — " + title, settings); workY = 33; }
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Gastos lançados nas planilhas", 10, workY + 6);
  const columns = ["Data", "Cliente", "Obra", "Categoria", "Descrição", "Valor"]; const widths = [24, 53, 62, 38, 65, 35];
  let y = tableHeader(pdf, columns, widths, workY + 10);
  y = addExpenseRows(pdf, entries, columns, widths, y, settings);
  pdf.setFillColor(23, 32, 51); pdf.rect(10, y + 3, 277, 9, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("Total de gastos: " + money.format(spent), 205, y + 9);
  pdf.save("relatorio-financeiro-" + safeFilename(title) + ".pdf");
}

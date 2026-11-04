export type PaymentMethod = "Dinheiro" | "Pix" | "Transferência" | "Cartão" | "Outros";
export type LedgerKind = "receivable" | "payable";
export type LedgerStatus = "Pendente" | "Pago parcialmente" | "Pago" | "Vencido" | "Cancelado";
export type PayableCategory = "Fornecedor" | "Funcionário" | "Materiais" | "Ferramentas" | "Combustível" | "Logística" | "Publicidade" | "Impostos" | "Administrativo" | "Outros";
export type LedgerPayment = { id: string; date: string; amount: number; method: PaymentMethod; discount: number; interest: number; notes: string; createdAt: string };
export type LedgerEntry = { id: string; kind: LedgerKind; description: string; category: PayableCategory; totalAmount: number; issueDate: string; dueDate: string; clientId?: string; budgetId?: string; workId?: string; supplierName: string; paymentMethod: PaymentMethod; status: LedgerStatus; notes: string; payments: LedgerPayment[]; createdAt: string; updatedAt: string };

export function paidAmount(entry: LedgerEntry) { return entry.payments.reduce((sum, payment) => sum + payment.amount + payment.interest - payment.discount, 0); }
export function balanceAmount(entry: LedgerEntry) { return Math.max(0, entry.totalAmount - paidAmount(entry)); }
export function currentLedgerStatus(entry: LedgerEntry, date = new Date().toISOString().slice(0, 10)): LedgerStatus {
  if (entry.status === "Cancelado") return "Cancelado";
  const paid = paidAmount(entry);
  if (paid >= entry.totalAmount) return "Pago";
  if (paid > 0) return "Pago parcialmente";
  return entry.dueDate && entry.dueDate < date ? "Vencido" : "Pendente";
}

export type FinancingInstallment = {
  number: number;
  dueDate: string;
  amount: number;
  paidAt?: string;
  fiscalDraftRequestedAt?: string;
  /** Observação interna específica da parcela. */
  note?: string;
};

export type Financing = {
  id: string;
  clientId: string;
  /** Nome livre do financiamento, útil quando ele reúne mais de uma obra. */
  name?: string;
  /** Referências principais preservadas para financiamentos antigos e integrações. */
  workId: string;
  budgetId: string;
  /** Todas as origens incluídas na proposta de financiamento. */
  workIds?: string[];
  budgetIds?: string[];
  principalAmount: number;
  /** Valor recebido na contratação, antes do parcelamento. */
  downPaymentAmount?: number;
  /** Saldo efetivamente parcelado, já descontada a entrada. */
  financedAmount?: number;
  installmentRate: number;
  installmentsCount: number;
  firstPaymentDate: string;
  totalFinanced: number;
  installments: FinancingInstallment[];
  /** Observação interna exibida junto ao financiamento. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const money = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function addMonths(dateText: string, months: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1 + months, day, 12);
  return date.toISOString().slice(0, 10);
}

export function createFinancingSchedule(principalAmount: number, installmentsCount: number, installmentRate: number, firstPaymentDate: string, downPaymentAmount = 0): Pick<Financing, "principalAmount" | "downPaymentAmount" | "financedAmount" | "installmentsCount" | "installmentRate" | "firstPaymentDate" | "totalFinanced" | "installments"> {
  const principal = money(Math.max(0, principalAmount));
  const count = Math.min(120, Math.max(1, Math.trunc(installmentsCount)));
  const rate = Math.max(0, Number(installmentRate) || 0);
  const downPayment = money(Math.min(principal, Math.max(0, Number(downPaymentAmount) || 0)));
  const financedAmount = money(principal - downPayment);
  const monthlyRate = rate / 100;
  const installmentExact = monthlyRate === 0
    ? financedAmount / count
    : financedAmount * monthlyRate * Math.pow(1 + monthlyRate, count) / (Math.pow(1 + monthlyRate, count) - 1);
  const totalFinanced = money(installmentExact * count);
  const standardAmount = money(installmentExact);
  const installments = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addMonths(firstPaymentDate, index),
    amount: index === count - 1 ? money(totalFinanced - standardAmount * (count - 1)) : standardAmount
  }));
  return { principalAmount: principal, downPaymentAmount: downPayment, financedAmount, installmentsCount: count, installmentRate: rate, firstPaymentDate, totalFinanced, installments };
}

/** Cria parcelas pelo valor que o cliente consegue pagar, respeitando o limite de 120 meses. */
export function createFinancingScheduleByInstallmentAmount(principalAmount: number, desiredInstallmentAmount: number, installmentRate: number, firstPaymentDate: string, downPaymentAmount = 0): Pick<Financing, "principalAmount" | "downPaymentAmount" | "financedAmount" | "installmentsCount" | "installmentRate" | "firstPaymentDate" | "totalFinanced" | "installments"> | null {
  const principal = money(Math.max(0, principalAmount));
  const desiredAmount = money(Math.max(0, Number(desiredInstallmentAmount) || 0));
  const rate = Math.max(0, Number(installmentRate) || 0);
  const downPayment = money(Math.min(principal, Math.max(0, Number(downPaymentAmount) || 0)));
  const financedAmount = money(principal - downPayment);
  if (!financedAmount || !desiredAmount) return null;
  const monthlyRate = rate / 100;
  const installments: FinancingInstallment[] = [];
  let balance = financedAmount;
  for (let index = 0; index < 120 && balance > 0.01; index += 1) {
    const due = money(balance * (1 + monthlyRate));
    if (desiredAmount <= money(due - balance)) return null;
    const amount = money(Math.min(desiredAmount, due));
    installments.push({ number: index + 1, dueDate: addMonths(firstPaymentDate, index), amount });
    balance = money(due - amount);
  }
  if (balance > 0.01) return null;
  const totalFinanced = money(installments.reduce((sum, installment) => sum + installment.amount, 0));
  return { principalAmount: principal, downPaymentAmount: downPayment, financedAmount, installmentsCount: installments.length, installmentRate: rate, firstPaymentDate, totalFinanced, installments };
}

export function installmentStatus(installment: FinancingInstallment, referenceDate = new Date().toISOString().slice(0, 10)) {
  if (installment.paidAt) return "Pago" as const;
  return installment.dueDate < referenceDate ? "Vencida" as const : "Pendente" as const;
}

export function financingSummary(financing: Financing, referenceDate = new Date().toISOString().slice(0, 10)) {
  const installmentsPaid = financing.installments.filter((item) => item.paidAt).reduce((sum, item) => sum + item.amount, 0);
  const downPayment = money(financing.downPaymentAmount || 0);
  const paid = money(installmentsPaid + downPayment);
  const overdue = financing.installments.filter((item) => installmentStatus(item, referenceDate) === "Vencida");
  return { paid, remaining: money(financing.totalFinanced - installmentsPaid), paidCount: financing.installments.filter((item) => item.paidAt).length, overdueCount: overdue.length, remainingCount: financing.installments.filter((item) => !item.paidAt).length };
}

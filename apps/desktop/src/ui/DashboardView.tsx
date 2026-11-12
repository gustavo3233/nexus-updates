import { useMemo, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { FinancialSheet } from "../domain/financial-sheet";
import type { Financing } from "../domain/financing";
import { balanceAmount, paidAmount, type LedgerEntry } from "../domain/ledger";
import type { Professional } from "../domain/professional";
import type { Settings } from "../domain/settings";
import type { Tool } from "../domain/tool";
import type { Work } from "../domain/work";
import { calculatePricing } from "../services/pricing";

type DashboardSection = "Visão geral" | "Financeiro" | "Operação" | "Comercial";
type Props = {
  budgets: Budget[]; clients: Client[]; sheets: FinancialSheet[]; settings: Settings; works: Work[]; ledgerEntries: LedgerEntry[]; tools: Tool[]; professionals: Professional[]; financings: Financing[];
  onOpenApprovedBudgets: () => void; onOpenOpenBudgets: () => void; onOpenRejectedBudgets: () => void; onOpenClients: () => void;
  onOpenCashflow: (filter: "all" | "receivable" | "payable") => void; onOpenFinance: () => void; onOpenWorksInProgress: () => void; onOpenToolsInUse: () => void; onOpenProfessionals: () => void; onOpenFinancing: () => void;
};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardView({ budgets, clients, sheets, settings, works, ledgerEntries, tools, professionals, financings, onOpenApprovedBudgets, onOpenOpenBudgets, onOpenRejectedBudgets, onOpenClients, onOpenCashflow, onOpenFinance, onOpenWorksInProgress, onOpenToolsInUse, onOpenProfessionals, onOpenFinancing }: Props) {
  const [days, setDays] = useState("30");
  const [section, setSection] = useState<DashboardSection>("Visão geral");
  const summary = useMemo(() => {
    const start = new Date(); if (days !== "all") start.setDate(start.getDate() - Number(days));
    const inRange = (date: string) => days === "all" || new Date(date + "T12:00:00") >= start;
    const filteredBudgets = budgets.filter((budget) => inRange(budget.issueDate));
    const approved = filteredBudgets.filter((budget) => budget.status === "Aprovado" || budget.status === "Faturado");
    const spent = sheets.flatMap((sheet) => sheet.expenses).filter((expense) => inRange(expense.date)).reduce((total, expense) => total + expense.amount, 0);
    const contracted = approved.reduce((total, budget) => total + calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue, 0);
    const taxes = approved.reduce((total, budget) => total + calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).taxes, 0);
    const entries = ledgerEntries.filter((entry) => inRange(entry.issueDate));
    const received = entries.filter((entry) => entry.kind === "receivable").reduce((total, entry) => total + paidAmount(entry), 0);
    const paid = entries.filter((entry) => entry.kind === "payable").reduce((total, entry) => total + paidAmount(entry), 0);
    const receivable = entries.filter((entry) => entry.kind === "receivable").reduce((total, entry) => total + balanceAmount(entry), 0);
    const payable = entries.filter((entry) => entry.kind === "payable").reduce((total, entry) => total + balanceAmount(entry), 0);
    const currentFinancings = financings.filter((financing) => financing.installments.some((installment) => !installment.paidAt));
    const overdueTools = tools.filter((tool) => tool.status === "Em uso" && Boolean(tool.assignment?.expectedReturnDate) && tool.assignment!.expectedReturnDate < new Date().toISOString().slice(0, 10));
    return { filteredBudgets, approved, spent, contracted, taxes, received, paid, receivable, payable, currentFinancings, overdueTools };
  }, [budgets, sheets, settings, ledgerEntries, financings, tools, days]);

  const show = (name: DashboardSection) => section === "Visão geral" || section === name;
  const activeProfessionals = professionals.filter((professional) => professional.active !== false);
  const toolsInUse = tools.filter((tool) => tool.status === "Em uso");
  const noFilterLabel = days === "all" ? "Sem filtro" : undefined;

  return <section>
    <div className="grid grid-cols-4 gap-2 rounded-xl border border-nexus-border bg-white p-2"><DashboardFilter active={section === "Visão geral"} label="Visão geral" onClick={() => setSection("Visão geral")} /><DashboardFilter active={section === "Financeiro"} label="Financeiro" onClick={() => setSection("Financeiro")} /><DashboardFilter active={section === "Operação"} label="Operação" onClick={() => setSection("Operação")} /><DashboardFilter active={section === "Comercial"} label="Comercial" onClick={() => setSection("Comercial")} /></div>

    <div className="mt-3 flex justify-end"><label className="text-xs font-semibold text-nexus-muted"><span className="sr-only">Período</span><select className="rounded-lg border border-nexus-primary bg-nexus-primary px-3 py-2 text-sm font-semibold text-white outline-none" value={days} onChange={(event) => setDays(event.target.value)}><option className="bg-white text-nexus-ink" value="7">1 semana</option><option className="bg-white text-nexus-ink" value="14">2 semanas</option><option className="bg-white text-nexus-ink" value="30">1 mês</option><option className="bg-white text-nexus-ink" value="60">2 meses</option><option className="bg-white text-nexus-ink" value="90">3 meses</option><option className="bg-white text-nexus-ink" value="all">Sem filtro</option></select>{noFilterLabel && <span className="mt-1 block text-right text-[10px]">Todos os registros</span>}</label></div>

    {show("Financeiro") && <section className="mt-6"><SectionTitle label="Financeiro" detail={days === "all" ? "Todos os períodos" : "Período selecionado"} /><div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4"><MoneyCard label="Contratado aprovado" value={summary.contracted} tone="blue" onClick={onOpenApprovedBudgets} /><MoneyCard label="Recebido (caixa real)" value={summary.received} tone="green" onClick={() => onOpenCashflow("receivable")} /><MoneyCard label="A receber" value={summary.receivable} tone="orange" onClick={() => onOpenCashflow("receivable")} /><MoneyCard label="A pagar" value={summary.payable} tone="violet" onClick={() => onOpenCashflow("payable")} /><MoneyCard label="Impostos" value={summary.taxes} tone="amber" /><MoneyCard label="Despesas realizadas" value={summary.spent} tone="red" onClick={onOpenFinance} /><MoneyCard label="Resultado estimado" value={summary.contracted - summary.taxes - summary.spent} tone="teal" onClick={onOpenFinance} /><MoneyCard label="Saldo realizado" value={summary.received - summary.paid} tone={summary.received - summary.paid >= 0 ? "green" : "red"} onClick={() => onOpenCashflow("all")} /></div></section>}

    {show("Operação") && <section className="mt-6"><SectionTitle label="Operação" detail="Situação atual da empresa" /><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><CountCard label="Obras em execução" value={works.filter((work) => work.status === "Em execução").length} detail={`${works.filter((work) => work.status === "Agendada" || work.status === "Aguardando início").length} agendada(s)`} tone="blue" onClick={onOpenWorksInProgress} /><CountCard label="Ferramentas em uso" value={toolsInUse.length} detail={summary.overdueTools.length ? `${summary.overdueTools.length} com devolução atrasada` : "Nenhuma devolução atrasada"} tone={summary.overdueTools.length ? "red" : "orange"} onClick={onOpenToolsInUse} /><CountCard label="Profissionais cadastrados" value={professionals.length} detail={`${activeProfessionals.length} ativo(s)`} tone="green" onClick={onOpenProfessionals} /><CountCard label="Financiamentos ativos" value={summary.currentFinancings.length} detail={`${summary.currentFinancings.reduce((total, financing) => total + financing.installments.filter((installment) => !installment.paidAt).length, 0)} parcela(s) em aberto`} tone="violet" onClick={onOpenFinancing} /></div><div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-nexus-border bg-white p-4 text-sm lg:grid-cols-4"><StatusLine label="Agendadas" value={works.filter((work) => work.status === "Agendada" || work.status === "Aguardando início").length} /><StatusLine label="Pausadas / material" value={works.filter((work) => work.status === "Pausada" || work.status === "Aguardando material").length} /><StatusLine label="Concluídas" value={works.filter((work) => work.status === "Concluída").length} /><StatusLine label="Ferramentas no depósito" value={tools.filter((tool) => tool.status === "No depósito").length} /></div></section>}

    {show("Comercial") && <section className="mt-6"><SectionTitle label="Comercial" detail="Orçamentos e relacionamento" /><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><CountCard label="Orçamentos enviados" value={summary.filteredBudgets.filter((budget) => budget.status === "Enviado" || budget.status === "Aberto").length} detail="Aguardando retorno" tone="orange" onClick={onOpenOpenBudgets} /><CountCard label="Orçamentos aprovados" value={summary.approved.length} detail="No período filtrado" tone="green" onClick={onOpenApprovedBudgets} /><CountCard label="Orçamentos recusados" value={summary.filteredBudgets.filter((budget) => budget.status === "Não aprovado").length} detail="No período filtrado" tone="red" onClick={onOpenRejectedBudgets} /><CountCard label="Clientes novos" value={clients.filter((client) => days === "all" || new Date(client.createdAt) >= new Date(Date.now() - Number(days) * 864e5)).length} detail={`${clients.filter((client) => client.active !== false).length} ativo(s) no total`} tone="blue" onClick={onOpenClients} /></div></section>}
  </section>;
}

function DashboardFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={(active ? "bg-nexus-primary text-white" : "bg-slate-50 text-nexus-muted hover:bg-slate-100") + " rounded-lg px-2 py-2 text-xs font-semibold"}>{label}</button>; }
function SectionTitle({ label, detail }: { label: string; detail: string }) { return <div className="flex items-center gap-3"><h2 className="text-lg font-bold text-nexus-ink">{label}</h2><span className="text-xs text-nexus-muted">{detail}</span></div>; }
function MoneyCard({ label, value, tone, onClick }: { label: string; value: number; tone: "blue" | "green" | "orange" | "violet" | "amber" | "red" | "teal"; onClick?: () => void }) { const styles = { blue: "border-blue-100", green: "border-emerald-100", orange: "border-orange-100", violet: "border-violet-100", amber: "border-amber-100", red: "border-red-100", teal: "border-teal-100" }; const body = <><p className="text-[11px] font-semibold uppercase tracking-wide text-nexus-muted">{label}</p><b className="mt-2 block text-xl text-nexus-ink">{money.format(value)}</b></>; return onClick ? <button type="button" onClick={onClick} className={`rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-nexus-primary ${styles[tone]}`}>{body}</button> : <div className={`rounded-xl border bg-white p-4 ${styles[tone]}`}>{body}</div>; }
function CountCard({ label, value, detail, tone, onClick }: { label: string; value: number; detail: string; tone: "blue" | "green" | "orange" | "violet" | "red"; onClick?: () => void }) { const styles = { blue: "border-blue-100", green: "border-emerald-100", orange: "border-orange-100", violet: "border-violet-100", red: "border-red-100" }; const body = <><p className="text-[11px] font-semibold uppercase tracking-wide text-nexus-muted">{label}</p><b className="mt-1 block text-2xl text-nexus-ink">{value}</b><p className="mt-1 text-xs text-nexus-muted">{detail}</p></>; return onClick ? <button type="button" onClick={onClick} className={`rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-nexus-primary ${styles[tone]}`}>{body}</button> : <div className={`rounded-xl border bg-white p-4 ${styles[tone]}`}>{body}</div>; }
function StatusLine({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-nexus-muted">{label}</p><b className="mt-1 block text-lg text-nexus-ink">{value}</b></div>; }

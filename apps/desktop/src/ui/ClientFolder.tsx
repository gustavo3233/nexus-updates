import { useEffect, useState } from "react";
import type { Budget, BudgetItem } from "../domain/budget";
import { fileCategoryLabels, type ClientFile, type ClientFileCategory } from "../domain/client-file";
import type { Client } from "../domain/client";
import type { FinancialSheet } from "../domain/financial-sheet";
import type { Settings } from "../domain/settings";
import { calculatePricing } from "../services/pricing";
import { expensesForBudget, listFinancialSheets } from "../storage/financial-sheet-repository";
import { BudgetPdfPreview } from "./BudgetPdfPreview";
import { generateBudgetPdf } from "../services/budget-pdf";
import type { Financing } from "../domain/financing";
import type { Work } from "../domain/work";
import { ClientForm } from "./ClientForm";
import { BudgetApprovalDialog, type ApprovalPaymentPlan } from "./BudgetApprovalDialog";

type Props = { client: Client; budgets: Budget[]; files: ClientFile[]; financings: Financing[]; works: Work[]; sheets?: FinancialSheet[]; settings: Settings; initialBudgetId?: string | null; onInitialBudgetOpened: () => void; onBack: () => void; onNewBudget: () => void; onEditBudget: (budget: Budget) => void; onCreateBudgetFromItems: (source: Budget, items: BudgetItem[]) => void; onCreateWork: (budget: Budget) => void; onUpdateBudget: (budget: Budget) => void; onApproveBudget: (budget: Budget, plan: ApprovalPaymentPlan) => void; onUpdateClient: (client: Client) => void; onDeleteBudget: (budget: Budget) => Promise<void>; onOpenFinancing: (financingId: string) => void; onUpload: (category: ClientFileCategory) => void };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const categories: ClientFileCategory[] = ["nota_fiscal", "documento", "planilha"];
type FolderTab = "client" | ClientFileCategory;

export function ClientFolder({ client, budgets, files, financings, works, sheets = listFinancialSheets(), settings, initialBudgetId, onInitialBudgetOpened, onBack, onNewBudget, onEditBudget, onCreateBudgetFromItems, onCreateWork, onUpdateBudget, onApproveBudget, onUpdateClient, onDeleteBudget, onOpenFinancing, onUpload }: Props) {
  const [selected, setSelected] = useState<Budget | null>(null);
  const [statusDraft, setStatusDraft] = useState<Budget["status"]>("Rascunho");
  const [preview, setPreview] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [advancedClient, setAdvancedClient] = useState(false);
  const [folderTab, setFolderTab] = useState<FolderTab>("client");
  const [itemsSource, setItemsSource] = useState<Budget | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [approvalBudget, setApprovalBudget] = useState<Budget | null>(null);
  useEffect(() => { if (initialBudgetId) { const budget = budgets.find((item) => item.id === initialBudgetId); if (budget) { setSelected(budget); setStatusDraft(budget.status); onInitialBudgetOpened(); } } }, [initialBudgetId, budgets, onInitialBudgetOpened]);
  const pricing = selected ? calculatePricing(selected.totalValue, settings, selected.pricingSnapshot) : null;
  const profitRate = selected?.pricingSnapshot?.applyProfit === false ? 0 : settings.companyProfitRate;
  const expenses = selected ? expensesForBudget(sheets, selected.id) : []; const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const timeline = [{ date: client.createdAt, text: "Cliente cadastrado" }, ...budgets.map(x => ({ date: x.createdAt, text: `Orçamento: ${x.title} · ${x.status}` })), ...files.map(x => ({ date: x.createdAt, text: `Arquivo salvo: ${x.name}` }))].sort((a,b) => b.date.localeCompare(a.date));
  const approvedBudgets = budgets.filter((budget) => budget.status === "Aprovado");
  const billedBudgets = budgets.filter((budget) => budget.status === "Faturado");
  const rejectedBudgets = budgets.filter((budget) => budget.status === "Não aprovado");
  const totalFor = (items: Budget[]) => items.reduce((sum, budget) => sum + calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue, 0);
  const currentFiles = folderTab === "client" ? [] : files.filter((file) => file.category === folderTab);
  return <>
<header className="border-b border-nexus-border pb-6">
<button className="text-sm font-semibold text-nexus-dark" onClick={onBack}>← Voltar para clientes</button>
<nav className="mt-3 flex flex-wrap gap-2 border-b border-nexus-border pb-3"><button type="button" className={"rounded-lg px-3 py-2 text-sm font-semibold " + (folderTab === "client" ? "bg-nexus-primary text-white" : "bg-slate-100 text-nexus-muted hover:bg-slate-200")} onClick={() => setFolderTab("client")}>Cliente</button>{categories.map((category) => <button type="button" key={category} className={"rounded-lg px-3 py-2 text-sm font-semibold " + (folderTab === category ? "bg-nexus-primary text-white" : "bg-slate-100 text-nexus-muted hover:bg-slate-200")} onClick={() => setFolderTab(category)}>{fileCategoryLabels[category]}</button>)}<button type="button" className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-nexus-muted hover:bg-slate-200" onClick={() => setAdvancedClient(true)}>Configurações avançadas</button></nav>
<div className="mt-4 flex items-start justify-between gap-4">
<div>
<p className="text-sm text-nexus-muted">Pasta do cliente</p>
<h1 className="mt-1 text-3xl font-bold text-nexus-ink">{client.name}</h1>
<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-nexus-muted"><span><b className="text-nexus-ink">Telefone:</b> {client.phone || "Não informado"}</span><span><b className="text-nexus-ink">Documento:</b> {client.document || "Não informado"}</span><span><b className="text-nexus-ink">E-mail:</b> {client.email || "Não informado"}</span><span><b className="text-nexus-ink">CEP / endereço:</b> {client.address || "Não informado"}</span></div>
</div>
<div className="flex shrink-0 gap-2"><button className="rounded-lg bg-nexus-primary px-4 py-3 text-sm font-semibold text-white" onClick={onNewBudget}>+ Criar orçamento</button></div>
</div>
</header>
{folderTab === "client" ? <>
<section className="mt-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><FolderSummaryMetric label="Orçamentos aprovados" value={approvedBudgets.length} detail="Aguardando faturamento" tone="green" /><FolderSummaryMetric label="Valor aprovado" value={money.format(totalFor(approvedBudgets))} detail="Total a cobrar" tone="green" /><FolderSummaryMetric label="Orçamentos faturados" value={billedBudgets.length} detail="Já faturados para este cliente" tone="blue" /><FolderSummaryMetric label="Valor faturado" value={money.format(totalFor(billedBudgets))} detail="Total já faturado" tone="blue" /><FolderSummaryMetric label="Orçamentos recusados" value={rejectedBudgets.length} detail="Sem aprovação" tone="red" /></div></section>
<section className="mt-6 rounded-xl border bg-white p-5">
<h2 className="font-semibold">Linha do tempo</h2>{timeline.map((event,index)=>
<p className="mt-2 text-sm" key={index}>• {event.text} <span className="text-nexus-muted">— {new Date(event.date).toLocaleDateString("pt-BR")}</span>
</p>)}</section>
<section className="mt-7 rounded-xl border border-nexus-border bg-white">
<div className="flex items-center justify-between border-b border-nexus-border px-5 py-4">
<h2 className="font-semibold">Orçamentos</h2>
<span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{budgets.length}</span>
</div>{budgets.length === 0 ? <p className="px-5 py-8 text-sm text-nexus-muted">Nenhum orçamento vinculado a este cliente.</p> : <div className="max-h-72 divide-y overflow-y-auto">{budgets.map((budget) => { const financing = financings.find((item) => item.budgetId === budget.id); const statusClass = budget.status === "Faturado" ? "bg-blue-100 text-blue-800" : budget.status === "Aprovado" ? "bg-emerald-100 text-emerald-800" : budget.status === "Não aprovado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"; return <div className="flex items-center justify-between gap-4 px-5 py-3" key={budget.id}>
<div className="min-w-0">
<p className="truncate font-semibold">{budget.title}</p>
<span className={"mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold " + statusClass}>{budget.status}</span>{financing && <span className="ml-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Financiado</span>}{budget.isCourtesy && <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Cortesia</span>}
</div>
<div className="flex shrink-0 items-center gap-4">
<p className="font-semibold">{budget.isCourtesy ? "Cortesia" : money.format(calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue)}</p>
<button className="rounded-lg border border-nexus-primary px-3 py-2 text-xs font-semibold" onClick={() => { setSelected(budget); setStatusDraft(budget.status); }}>Abrir orçamento</button>
{financing && <button className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800" onClick={() => onOpenFinancing(financing.id)}>Abrir financiamento</button>}
{works.some((work) => work.budgetId === budget.id) ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Obra criada</span> : <button className="rounded-lg border border-nexus-primary px-3 py-2 text-xs font-semibold text-nexus-primary disabled:opacity-40" disabled={budget.status !== "Aprovado"} title={budget.status !== "Aprovado" ? "A obra só pode ser criada a partir de um orçamento aprovado." : "Criar obra"} onClick={() => onCreateWork(budget)}>Criar obra</button>}
<button className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={() => generateBudgetPdf(budget, client, settings)}>Baixar orçamento</button>
</div>
</div>; })}</div>}</section>
</> : <section className="mt-6 rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{fileCategoryLabels[folderTab]}</h2><button className="rounded-lg border border-nexus-primary px-3 py-2 text-xs font-semibold text-nexus-primary" onClick={() => onUpload(folderTab)}>Adicionar</button></div><div className="mt-4 space-y-2">{currentFiles.length === 0 ? <p className="text-sm text-nexus-muted">Nenhum arquivo salvo nesta seção.</p> : currentFiles.map((file) => <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm" key={file.id}>{file.name}</div>)}</div></section>}{selected && pricing ? <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-8">
<section className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
<header className="flex justify-between border-b pb-4">
<div>
<p className="text-sm text-nexus-muted">Orçamento interno</p>
<h2 className="mt-1 text-2xl font-bold">{selected.title}</h2>
<p className="mt-1 text-sm text-nexus-muted">{client.name} · {selected.workAddress}</p>
</div>
<div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={() => generateBudgetPdf(selected, client, settings)}>Baixar orçamento</button><button className="rounded-lg border border-nexus-primary px-3 py-2 text-sm font-semibold text-nexus-primary" onClick={() => setPreview(true)}>Ver prévia do PDF</button><button className="rounded-lg border border-nexus-primary px-3 py-2 text-sm font-semibold text-nexus-primary" onClick={() => { onEditBudget(selected); setSelected(null); }}>Editar orçamento</button><button className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => { setDeleteError(""); setDeletingBudget(selected); }}>Apagar orçamento</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setSelected(null)}>Fechar</button></div>
</header>
<div className="mt-4 flex items-end justify-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="text-sm font-medium">Status do orçamento<select className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as Budget["status"])}><option value="Rascunho">Rascunho</option><option value="Aberto">Aberto</option><option value="Aprovado">Aprovado</option><option value="Não aprovado">Recusado</option><option value="Faturado">Faturado</option></select></label><button className="rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white" onClick={() => { const next = { ...selected, status: statusDraft }; if (statusDraft === "Aprovado" && selected.status !== "Aprovado") setApprovalBudget(next); else onUpdateBudget(next); }}>Atualizar status</button></div>
<div className="mt-5 grid grid-cols-5 gap-3">
<Metric title="Valor base" value={pricing.baseValue} />
<Metric title={`Impostos (${pricing.taxRate}%)`} value={pricing.taxes} tone="red" />
<Metric title={"Lucro (" + profitRate + "%)"} value={pricing.companyProfit} tone="green" />
<Metric title="Gastos lançados" value={expenseTotal} tone="red" />
<Metric title="Valor total a cobrar" value={pricing.chargedValue} tone="dark" />
</div>
<p className="mt-3 text-xs text-nexus-muted">Os gastos vêm da planilha financeira vinculada a esta obra.</p>
<div className="mt-6 flex justify-end"><button className="rounded-lg border border-nexus-primary px-3 py-2 text-sm font-semibold text-nexus-primary" onClick={() => { setItemsSource(selected); setSelectedItemIds([]); }}>Gerar outro orçamento</button></div>
<div className="mt-3 overflow-hidden rounded-xl border">
<div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-nexus-muted">
<span className="col-span-6">Item</span>
<span className="col-span-2">Quantidade</span>
<span className="col-span-2">Unitário</span>
<span className="col-span-2 text-right">Total</span>
</div>{selected.items.map((item) => <div className="grid grid-cols-12 border-t px-4 py-3 text-sm" key={item.id}>
<span className="col-span-6">{item.description}</span>
<span className="col-span-2">{item.quantity} {item.unit}</span>
<span className="col-span-2">{money.format(item.unitPrice)}</span>
<span className="col-span-2 text-right font-medium">{money.format(item.quantity * item.unitPrice)}</span>
</div>)}</div>
</section>
</div> : null}
{itemsSource ? <BudgetItemSelectionDialog source={itemsSource} selectedItemIds={selectedItemIds} onToggle={(itemId) => setSelectedItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId])} onCancel={() => setItemsSource(null)} onConfirm={() => { onCreateBudgetFromItems(itemsSource, itemsSource.items.filter((item) => selectedItemIds.includes(item.id))); setItemsSource(null); setSelected(null); }} /> : null}
{approvalBudget ? <BudgetApprovalDialog title={approvalBudget.title} amount={calculatePricing(approvalBudget.totalValue, settings, approvalBudget.pricingSnapshot).chargedValue} onCancel={() => setApprovalBudget(null)} onConfirm={(plan) => { onApproveBudget(approvalBudget, plan); setSelected(approvalBudget); setApprovalBudget(null); }} /> : null}
{preview && selected ? <BudgetPdfPreview budget={selected} client={client} settings={settings} onClose={() => setPreview(false)} /> : null}
{deletingBudget ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-6"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold text-red-800">Apagar orçamento permanentemente?</h2><p className="mt-3 text-sm text-nexus-muted">Esta ação apaga o orçamento e todos os dados vinculados a ele, como planilhas, obra, diárias, compras, documentos e lançamentos financeiros. Não será possível recuperar pelo aplicativo.</p>{deleteError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border px-4 py-2 text-sm font-semibold" disabled={deleting} onClick={() => setDeletingBudget(null)}>Cancelar</button><button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={deleting} onClick={async () => { setDeleting(true); setDeleteError(""); try { await onDeleteBudget(deletingBudget); setSelected(null); setDeletingBudget(null); } catch (error) { setDeleteError(error instanceof Error ? error.message : "Não foi possível apagar o orçamento."); } finally { setDeleting(false); } }}>{deleting ? "Apagando..." : "Sim, apagar permanentemente"}</button></div></section></div> : null}
{advancedClient ? <ClientForm initialClient={client} onCancel={() => setAdvancedClient(false)} onSave={(nextClient) => { onUpdateClient(nextClient); setAdvancedClient(false); }} /> : null}</>;
}

function Metric({ title, value, tone = "base" }: { title: string; value: number; tone?: "base" | "red" | "green" | "dark" }) { const colors = { base: "bg-slate-50", red: "bg-red-50 text-red-800", green: "bg-emerald-50 text-emerald-800", dark: "bg-nexus-ink text-white" }; return <div className={`rounded-xl p-4 ${colors[tone]}`}>
<p className="text-xs uppercase opacity-70">{title}</p>
<p className="mt-1 text-lg font-bold">{money.format(value)}</p>
</div>; }

function BudgetItemSelectionDialog({ source, selectedItemIds, onToggle, onCancel, onConfirm }: { source: Budget; selectedItemIds: string[]; onToggle: (itemId: string) => void; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-nexus-muted">Novo orçamento a partir de itens</p><h2 className="mt-1 text-xl font-bold">Selecione os itens desejados</h2><p className="mt-2 text-sm text-nexus-muted">Os itens selecionados serão copiados para um novo orçamento. Gastos estimados não serão levados.</p></div><button type="button" className="text-xl text-nexus-muted" onClick={onCancel} aria-label="Fechar">×</button></div><div className="mt-5 overflow-hidden rounded-xl border"><div className="grid grid-cols-[44px_minmax(0,1fr)_90px_130px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-nexus-muted"><span /><span>Item</span><span>Quantidade</span><span className="text-right">Total</span></div>{source.items.map((item) => <label key={item.id} className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_90px_130px] items-center gap-3 border-t px-4 py-3 text-sm hover:bg-orange-50"><input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => onToggle(item.id)} /><span><b className="block">{item.description || "Item sem descrição"}</b><small className="text-nexus-muted">{item.kind === "product" ? "Produto" : "Serviço"} · {item.unit}</small></span><span>{item.quantity}</span><b className="text-right">{item.isCourtesy ? "Cortesia" : money.format(item.quantity * item.unitPrice)}</b></label>)}</div><p className="mt-3 text-sm text-nexus-muted">{selectedItemIds.length} {selectedItemIds.length === 1 ? "item selecionado" : "itens selecionados"}</p><div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={onCancel}>Cancelar</button><button type="button" className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={selectedItemIds.length === 0} onClick={onConfirm}>Continuar para novo orçamento</button></div></section></div>; }

function FolderSummaryMetric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: "green" | "blue" | "red" }) { const colors = { green: "border-emerald-100 bg-emerald-50", blue: "border-blue-100 bg-blue-50", red: "border-red-100 bg-red-50" }; return <div className={"rounded-xl border p-4 " + colors[tone]}><p className="text-xs font-semibold uppercase tracking-wide text-nexus-muted">{label}</p><p className="mt-2 text-xl font-bold text-nexus-ink">{value}</p><p className="mt-1 text-xs text-nexus-muted">{detail}</p></div>; }

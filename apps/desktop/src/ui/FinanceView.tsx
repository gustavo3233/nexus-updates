import { useEffect, useMemo, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import { emptyExpense, expenseCategoryLabels, type ExpenseCategory, type FinancialExpense, type FinancialSheet } from "../domain/financial-sheet";
import type { Professional } from "../domain/professional";
import type { Settings } from "../domain/settings";
import type { Work } from "../domain/work";
import { calculatePricing } from "../services/pricing";
import { exportWorkSpreadsheet, generateWorkSpreadsheetPdf } from "../services/spreadsheet-export";

type Props = { clients: Client[]; budgets: Budget[]; works: Work[]; professionals: Professional[]; sheets: FinancialSheet[]; settings: Settings; onSave: (sheet: FinancialSheet) => void; onDelete: (sheetId: string) => Promise<void> };
type FinanceProject = { id: string; budgetId: string; work?: Work; label: string; address: string; stateLabel: string; estimatedAmount: number };
type SheetFilter = "Em aberto" | "Todas" | "Finalizadas" | "Canceladas";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const estimatedExpensesTotal = (budget?: Budget) => (budget?.estimatedExpenses ?? []).reduce((sum, expense) => sum + expense.amount, 0);

export function FinanceView({ clients, budgets, works, professionals, sheets, settings, onSave, onDelete }: Props) {
  const projects = useMemo<FinanceProject[]>(() => {
    const openWorks = works.filter((work) => work.status !== "Concluída" && work.status !== "Cancelada");
    const fromWorks: FinanceProject[] = openWorks.map((work) => {
      const budget = budgets.find((item) => item.id === work.budgetId);
      return { id: `work-${work.id}`, budgetId: work.budgetId, work, label: budget?.title || work.contractedServices || work.number, address: work.address, stateLabel: "Obra em aberto", estimatedAmount: estimatedExpensesTotal(budget) };
    });
    const byBudget = new Set(fromWorks.map((project) => project.budgetId));
    budgets
      .filter((budget) => (budget.status === "Aberto" || budget.status === "Aprovado" || budget.status === "Faturado") && !byBudget.has(budget.id))
      .forEach((budget) => fromWorks.push({ id: `budget-${budget.id}`, budgetId: budget.id, label: budget.title, address: budget.workAddress, stateLabel: budget.status === "Faturado" ? "Orçamento faturado" : budget.status === "Aprovado" ? "Orçamento aprovado" : "Orçamento em aberto", estimatedAmount: estimatedExpensesTotal(budget) }));
    sheets.forEach((sheet) => {
      if (byBudget.has(sheet.budgetId) || fromWorks.some((project) => project.budgetId === sheet.budgetId)) return;
      const budget = budgets.find((item) => item.id === sheet.budgetId);
      if (budget) fromWorks.push({ id: `legacy-${budget.id}`, budgetId: budget.id, label: budget.title, address: budget.workAddress, stateLabel: "Planilha existente", estimatedAmount: estimatedExpensesTotal(budget) });
    });
    return fromWorks;
  }, [works, budgets, sheets]);
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newSheetTitle, setNewSheetTitle] = useState("");
  const [sheetFilter, setSheetFilter] = useState<SheetFilter>("Em aberto");
  const visibleProjects = useMemo(() => projects.filter((project) => {
    const projectSheets = sheets.filter((sheet) => sheet.budgetId === project.budgetId && (!project.work || sheet.workId === project.work.id || !sheet.workId));
    if (sheetFilter === "Todas") return true;
    if (sheetFilter === "Finalizadas") return projectSheets.some((sheet) => sheet.status === "Finalizada");
    if (sheetFilter === "Canceladas") return projectSheets.some((sheet) => sheet.status === "Cancelada");
    return projectSheets.length === 0 || projectSheets.some((sheet) => !sheet.status || sheet.status === "Aberta");
  }), [projects, sheets, sheetFilter]);
  const project = visibleProjects.find((item) => item.id === projectId) || null;
  const work = project?.work || null;
  const budget = project ? budgets.find((item) => item.id === project.budgetId) || null : null;
  const client = budget ? clients.find((item) => item.id === budget.clientId) || null : null;
  const workSheets = project ? sheets.filter((sheet) => sheet.budgetId === project.budgetId && (!work || sheet.workId === work.id || !sheet.workId)) : [];
  const visibleSheets = workSheets.filter((sheet) => sheetFilter === "Todas" || (sheetFilter === "Em aberto" ? !sheet.status || sheet.status === "Aberta" : sheetFilter === "Finalizadas" ? sheet.status === "Finalizada" : sheet.status === "Cancelada"));
  const selected = visibleSheets.find((sheet) => sheet.id === sheetId) || null;
  useEffect(() => {
    if (!project) {
      if (visibleProjects[0]?.id && projectId !== visibleProjects[0].id) setProjectId(visibleProjects[0].id);
      setSheetId(null);
      setEditing(false);
      return;
    }
    if (!visibleSheets.some((sheet) => sheet.id === sheetId)) {
      setSheetId(visibleSheets[0]?.id || null);
      setEditing(false);
    }
  }, [projectId, project?.id, sheets.length, sheetFilter, visibleProjects, visibleSheets]);
  const save = (sheet: FinancialSheet) => onSave({ ...sheet, updatedAt: new Date().toISOString() });
  const beginCreate = () => {
    setNewProjectId(project?.id || projects[0]?.id || "");
    setNewSheetTitle("");
    setCreating(true);
  };
  const create = () => {
    const target = projects.find((item) => item.id === newProjectId);
    const targetBudget = target ? budgets.find((item) => item.id === target.budgetId) : null;
    const targetClient = targetBudget ? clients.find((item) => item.id === targetBudget.clientId) : null;
    if (!target || !targetBudget || !targetClient) return;
    const now = new Date().toISOString();
    const targetSheets = sheets.filter((sheet) => sheet.budgetId === targetBudget.id);
    const sheet: FinancialSheet = { id: crypto.randomUUID(), clientId: targetClient.id, budgetId: targetBudget.id, workId: target.work?.id, title: newSheetTitle.trim() || `Planilha ${targetSheets.length + 1}`, status: "Aberta", createdAt: now, updatedAt: now, expenses: [] };
    save(sheet); setProjectId(target.id); setSheetId(sheet.id); setEditing(true); setCreating(false);
  };
  const remove = async () => {
    if (!selected || !window.confirm("Deseja apagar esta planilha e todos os gastos lançados nela? Esta ação não poderá ser desfeita.")) return;
    await onDelete(selected.id); setSheetId(null);
  };
  return <><div className="flex justify-end"><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" disabled={!projects.length} onClick={beginCreate}>+ Criar planilha</button></div>
    <div className="mt-4 grid h-[calc(100vh-10rem)] min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-5 overflow-hidden"><aside className="flex h-full min-h-0 flex-col rounded-xl border bg-white p-3"><div className="shrink-0 border-b border-slate-100 px-1 pb-3"><div className="grid grid-cols-4 gap-1"><SheetFilterButton active={sheetFilter === "Todas"} label="Todas" onClick={() => setSheetFilter("Todas")} /><SheetFilterButton active={sheetFilter === "Em aberto"} label="Em aberto" onClick={() => setSheetFilter("Em aberto")} /><SheetFilterButton active={sheetFilter === "Finalizadas"} label="Finalizadas" onClick={() => setSheetFilter("Finalizadas")} /><SheetFilterButton active={sheetFilter === "Canceladas"} label="Canceladas" onClick={() => setSheetFilter("Canceladas")} /></div><p className="mt-3 px-1 text-xs font-semibold uppercase text-nexus-muted">{sheetFilter === "Todas" ? "Obras e orçamentos" : `Planilhas ${sheetFilter.toLocaleLowerCase("pt-BR")}`}</p></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{visibleProjects.length === 0 ? <p className="p-3 text-sm text-nexus-muted">Nenhuma planilha {sheetFilter.toLocaleLowerCase("pt-BR")} encontrada.</p> : visibleProjects.map((item) => { const itemClient = clients.find((clientItem) => clientItem.id === budgets.find((budgetItem) => budgetItem.id === item.budgetId)?.clientId); const total = sheets.filter((sheet) => sheet.budgetId === item.budgetId).length; return <button key={item.id} className={"mb-1 w-full rounded-lg p-3 text-left text-sm " + (projectId === item.id ? "bg-orange-50 ring-1 ring-orange-200" : "hover:bg-slate-50")} onClick={() => setProjectId(item.id)}><b className="block truncate">{item.label}</b><span className="block truncate text-xs text-nexus-muted">{itemClient?.name || "Cliente não localizado"} · {total} planilha(s)</span><span className="mt-2 flex flex-wrap gap-1"><i className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold not-italic text-emerald-800">{item.stateLabel}</i>{item.estimatedAmount > 0 && <i className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold not-italic text-orange-800">Gasto estimado: {money.format(item.estimatedAmount)}</i>}</span></button>; })}</div></aside>
      <section className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-xl border bg-white">{!project || !budget || !client ? <p className="p-12 text-center text-sm text-nexus-muted">Selecione uma planilha para continuar.</p> : !selected ? <WorkSheets project={project} budget={budget} client={client} sheets={visibleSheets} onCreate={beginCreate} onOpen={(sheet) => { setSheetId(sheet.id); setEditing(false); }} /> : <SheetEditor sheet={selected} budget={budget} client={client} professionals={professionals} settings={settings} editing={editing && selected.status !== "Finalizada" && selected.status !== "Cancelada"} onEdit={() => setEditing(true)} onSave={save} onFinalize={() => { if (window.confirm("Finalizar esta planilha? Os gastos continuarão visíveis, mas ficarão bloqueados para edição.")) save({ ...selected, status: "Finalizada", finalizedAt: new Date().toISOString() }); }} onReopen={() => { if (window.confirm("Reabrir esta planilha para edição?")) save({ ...selected, status: "Aberta", finalizedAt: undefined }); }} onDelete={() => void remove()} onPreview={() => setPreview(generateWorkSpreadsheetPdf(client, budget, selected, settings, false))} onDownload={() => exportWorkSpreadsheet(client, budget, selected, settings)} />}</section></div>
    {preview && <PdfPreview source={preview} onClose={() => setPreview(null)} />}
    {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">Criar planilha financeira</h2><p className="mt-1 text-sm text-nexus-muted">Escolha a obra ou o orçamento que receberá esta planilha. A planilha será aberta em modo de edição após a confirmação.</p><label className="mt-5 block text-sm">Obra ou orçamento<select className="mt-1 w-full rounded border px-3 py-2" value={newProjectId} onChange={(event) => setNewProjectId(event.target.value)}><option value="">Selecione</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.label} · {clients.find((clientItem) => clientItem.id === budgets.find((budgetItem) => budgetItem.id === item.budgetId)?.clientId)?.name || "Cliente"} · {item.stateLabel}</option>)}</select></label><label className="mt-4 block text-sm">Nome da planilha <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" value={newSheetTitle} onChange={(event) => setNewSheetTitle(event.target.value)} placeholder="Ex.: Gastos da primeira etapa" /></label><div className="mt-6 flex justify-end gap-3"><button onClick={() => setCreating(false)}>Cancelar</button><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!newProjectId} onClick={create}>Criar e editar</button></div></section></div>}
  </>;
}

function SheetFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={(active ? "bg-nexus-primary text-white" : "bg-slate-100 text-nexus-muted hover:bg-slate-200") + " min-w-0 rounded-md px-1 py-1.5 text-[10px] font-semibold leading-tight"}>{label}</button>;
}

function WorkSheets({ project, budget, client, sheets, onCreate, onOpen }: { project: FinanceProject; budget: Budget; client: Client; sheets: FinancialSheet[]; onCreate: () => void; onOpen: (sheet: FinancialSheet) => void }) {
  return <div className="p-6"><p className="text-sm text-nexus-muted">{client.name}</p><h2 className="mt-1 text-xl font-bold">{budget.title}</h2><p className="mt-1 text-sm text-nexus-muted">{project.work?.number || "Orçamento sem obra criada"} · {project.address || "Endereço não informado"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{project.stateLabel}</span>{project.estimatedAmount > 0 && <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">Gasto estimado: {money.format(project.estimatedAmount)}</span>}</div><div className="mt-6 flex items-center justify-between"><h3 className="font-semibold">Planilhas desta obra</h3><button className="rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white" onClick={onCreate}>+ Nova planilha</button></div>{sheets.length === 0 ? <p className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-nexus-muted">Ainda não há planilhas para esta obra.</p> : <div className="mt-4 space-y-2">{sheets.map((sheet, index) => <button key={sheet.id} className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:border-nexus-primary" onClick={() => onOpen(sheet)}><div><b>{sheet.title || `Planilha ${index + 1}`}</b><p className="mt-1 text-sm text-nexus-muted">{sheet.expenses.length} gasto(s) · criada em {new Date(sheet.createdAt).toLocaleDateString("pt-BR")}</p></div><span className={"rounded-full px-2 py-1 text-xs font-semibold " + (sheet.status === "Finalizada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{sheet.status || "Aberta"}</span></button>)}</div>}</div>;
}

function SheetEditor({ sheet, budget, client, professionals, settings, editing, onEdit, onSave, onFinalize, onReopen, onDelete, onPreview, onDownload }: { sheet: FinancialSheet; budget: Budget; client: Client; professionals: Professional[]; settings: Settings; editing: boolean; onEdit: () => void; onSave: (sheet: FinancialSheet) => void; onFinalize: () => void; onReopen: () => void; onDelete: () => void; onPreview: () => void; onDownload: () => void }) {
  const actual = sheet.expenses.reduce((sum, item) => sum + item.amount, 0); const estimated = estimatedExpensesTotal(budget); const pricing = calculatePricing(budget.totalValue, settings, budget.pricingSnapshot);
  const update = (index: number, value: Partial<FinancialExpense>) => onSave({ ...sheet, expenses: sheet.expenses.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  const removeExpense = (id: string) => onSave({ ...sheet, expenses: sheet.expenses.filter((expense) => expense.id !== id) });
  const add = () => onSave({ ...sheet, expenses: [...sheet.expenses, emptyExpense()] });
  return <><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><p className="text-sm text-nexus-muted">{client.name} · {budget.title}</p><h2 className="mt-1 text-xl font-bold">{sheet.title || "Planilha financeira"}</h2><span className={"mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold " + (sheet.status === "Finalizada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{sheet.status || "Aberta"}</span></div><div className="flex flex-wrap justify-end gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={onPreview}>Ver prévia</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={onDownload}>↓ Baixar PDF</button>{sheet.status === "Finalizada" ? <button className="rounded-lg border px-3 py-2 text-sm" onClick={onReopen}>Reabrir</button> : <>{editing ? <button className="rounded-lg border border-nexus-primary bg-orange-50 px-3 py-2 text-sm font-semibold text-nexus-primary" onClick={add}>+ Adicionar gasto real</button> : <button className="rounded-lg border px-3 py-2 text-sm" onClick={onEdit}>Editar planilha</button>}<button className="rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white" onClick={onFinalize}>Finalizar planilha</button></>}<button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700" onClick={onDelete}>Apagar</button></div></div>
    <div className="grid grid-cols-4 gap-3 p-4"><Card title="Valor cobrado" value={pricing.chargedValue} /><Card title="Gasto estimado" value={estimated} color="orange" /><Card title="Gasto real" value={actual} color="red" /><Card title={actual > estimated ? "Déficit vs. estimado" : "Superávit vs. estimado"} value={Math.abs(estimated - actual)} color={actual > estimated ? "red" : "green"} /></div>
    {editing && <p className="mx-4 rounded-lg bg-orange-50 px-3 py-2 text-sm text-nexus-dark">Modo de edição ativo. Adicione ou altere os gastos reais e finalize a planilha quando concluir.</p>}
    <div className="mt-4 border-t"><div className="grid grid-cols-[94px_120px_minmax(0,1fr)_110px_24px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase text-nexus-muted"><span>Data</span><span>Categoria</span><span>Descrição / profissional</span><span>Valor</span><span /></div><div className="max-h-[430px] overflow-y-auto">{sheet.expenses.length === 0 ? <p className="p-6 text-center text-sm text-nexus-muted">Nenhum gasto real lançado.</p> : sheet.expenses.map((expense, index) => <ExpenseRow key={expense.id} expense={expense} professionals={professionals} disabled={!editing} onChange={(value) => update(index, value)} onDelete={() => removeExpense(expense.id)} />)}</div></div></>;
}

function ExpenseRow({ expense, professionals, disabled, onChange, onDelete }: { expense: FinancialExpense; professionals: Professional[]; disabled: boolean; onChange: (value: Partial<FinancialExpense>) => void; onDelete: () => void }) {
  const listId = `professional-${expense.id}`; const active = professionals.filter((professional) => professional.active !== false);
  const setDescription = (description: string) => { const professional = active.find((item) => item.name.trim().toLocaleLowerCase("pt-BR") === description.trim().toLocaleLowerCase("pt-BR")); onChange(professional ? { description: professional.name, professionalId: professional.id, amount: professional.dailyRate } : { description, professionalId: undefined }); };
  return <div className="grid grid-cols-[94px_120px_minmax(0,1fr)_110px_24px] gap-2 border-t px-3 py-2"><input disabled={disabled} className="min-w-0 rounded border px-1 py-1 text-xs disabled:bg-slate-50" type="date" value={expense.date} onChange={(event) => onChange({ date: event.target.value })} /><select disabled={disabled} className="min-w-0 rounded border px-1 py-1 text-xs disabled:bg-slate-50" value={expense.category} onChange={(event) => onChange({ category: event.target.value as ExpenseCategory, professionalId: undefined })}>{(Object.entries(expenseCategoryLabels) as [ExpenseCategory, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{expense.category === "funcionario" ? <><div className="min-w-0"><input disabled={disabled} list={listId} className="w-full rounded border px-2 py-1 text-xs disabled:bg-slate-50" value={expense.description} onChange={(event) => setDescription(event.target.value)} placeholder="Digite ou selecione o profissional" /><datalist id={listId}>{active.map((professional) => <option key={professional.id} value={professional.name}>{money.format(professional.dailyRate)}/diária</option>)}</datalist><p className="mt-1 text-[10px] text-nexus-muted">Ao selecionar, usa a diária cadastrada; você pode ajustar.</p></div><input disabled={disabled} className="min-w-0 rounded border px-1 py-1 text-xs disabled:bg-slate-50" type="number" min="0" step="0.01" value={expense.amount || ""} onChange={(event) => onChange({ amount: Number(event.target.value) })} /></> : <><input disabled={disabled} className="min-w-0 rounded border px-2 py-1 text-xs disabled:bg-slate-50" value={expense.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Descrição do gasto" /><input disabled={disabled} className="min-w-0 rounded border px-1 py-1 text-xs disabled:bg-slate-50" type="number" min="0" step="0.01" value={expense.amount || ""} onChange={(event) => onChange({ amount: Number(event.target.value) })} /></>}<button disabled={disabled} className="text-nexus-error disabled:opacity-40" onClick={onDelete}>×</button></div>;
}

function PdfPreview({ source, onClose }: { source: string; onClose: () => void }) { return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-6"><section className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">Prévia da planilha</h2><p className="text-sm text-nexus-muted">Visualização interna — o PDF não foi baixado.</p></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Fechar</button></header><iframe className="min-h-0 flex-1 bg-slate-100" title="Prévia da planilha financeira" src={source} /></section></div>; }
function Card({ title, value, color = "slate" }: { title: string; value: number; color?: "slate" | "orange" | "red" | "green" }) { const colors = { slate: "bg-slate-50", orange: "bg-orange-50", red: "bg-red-50 text-red-800", green: "bg-emerald-50 text-emerald-800" }; return <div className={"rounded-xl p-3 " + colors[color]}><p className="truncate text-[10px] uppercase">{title}</p><b className="mt-1 block truncate text-sm">{money.format(value)}</b></div>; }

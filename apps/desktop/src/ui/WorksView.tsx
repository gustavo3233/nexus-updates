import { useEffect, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { Work, WorkStatus } from "../domain/work";
import { workStatuses } from "../domain/work";
import type { Professional } from "../domain/professional";

type WorkFilter = "Todos" | WorkStatus;
type Props = { works: Work[]; clients: Client[]; budgets: Budget[]; professionals: Professional[]; initialStatusFilter?: WorkFilter; onSave: (work: Work) => void; onCreateWork: (budget: Budget) => void };
const input = "mt-1 w-full rounded-lg border border-nexus-border px-3 py-2 text-sm";
const workStatusTone: Record<WorkStatus, string> = {
  "Aguardando início": "bg-slate-100 text-slate-700",
  "Agendada": "bg-sky-100 text-sky-800",
  "Em execução": "bg-orange-100 text-orange-800",
  "Pausada": "bg-amber-100 text-amber-800",
  "Aguardando material": "bg-yellow-100 text-yellow-800",
  "Aguardando aprovação do cliente": "bg-violet-100 text-violet-800",
  "Concluída": "bg-emerald-100 text-emerald-800",
  "Cancelada": "bg-red-100 text-red-800"
};

export function WorksView({ works, clients, budgets, professionals, initialStatusFilter = "Todos", onSave, onCreateWork }: Props) {
  const [statusFilter, setStatusFilter] = useState<WorkFilter>(initialStatusFilter);
  const shownWorks = works.filter((work) => statusFilter === "Todos" || work.status === statusFilter);
  const [selectedId, setSelectedId] = useState<string | null>(shownWorks[0]?.id ?? null);
  const [statusReason, setStatusReason] = useState("");
  const [log, setLog] = useState({ activities: "", pendingServices: "", problems: "", materialsNeeded: "", professionalsPresent: "", notes: "" });
  const [professionalId, setProfessionalId] = useState("");
  const [creating, setCreating] = useState(false);
  const [budgetToCreate, setBudgetToCreate] = useState("");
  useEffect(() => {
    setSelectedId((current) => shownWorks.some((work) => work.id === current) ? current : shownWorks[0]?.id ?? null);
  }, [statusFilter, works]);
  const selected = shownWorks.find((work) => work.id === selectedId) ?? null;
  const client = selected ? clients.find((item) => item.id === selected.clientId) : null;
  const budget = selected ? budgets.find((item) => item.id === selected.budgetId) : null;
  const activeProfessionals = professionals.filter((professional) => professional.active !== false).sort((first, second) => first.name.localeCompare(second.name));
  const saveStatus = (status: WorkStatus) => {
    if (!selected || status === selected.status) return;
    const happenedAt = new Date().toISOString();
    onSave({ ...selected, status, completedAt: status === "Concluída" ? happenedAt.slice(0, 10) : selected.completedAt, updatedAt: happenedAt, statusHistory: [...selected.statusHistory, { id: crypto.randomUUID(), status, reason: statusReason.trim() || "Status alterado.", happenedAt }] });
    setStatusReason("");
  };
  const saveLog = () => {
    if (!selected || !log.activities.trim()) return;
    const createdAt = new Date().toISOString();
    onSave({ ...selected, updatedAt: createdAt, dailyLogs: [{ id: crypto.randomUUID(), date: createdAt.slice(0, 10), ...log, photos: [], createdAt }, ...selected.dailyLogs] });
    setLog({ activities: "", pendingServices: "", problems: "", materialsNeeded: "", professionalsPresent: "", notes: "" }); setProfessionalId("");
  };
  const availableBudgets = budgets.filter((item) => (item.status === "Aprovado" || item.status === "Faturado") && !works.some((work) => work.budgetId === item.id));
  return <>
    <div className="flex justify-end gap-2"><span className="rounded-full bg-slate-100 px-3 py-2 text-sm">{shownWorks.length} obra(s)</span><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating(true)}>+ Criar obra</button></div>
    <div className="mt-6 grid h-[calc(100vh-14rem)] min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-5 overflow-hidden">
      <aside className="flex h-full min-h-0 flex-col rounded-xl border bg-white p-3"><div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-2"><p className="text-xs font-semibold uppercase text-nexus-muted">Obras cadastradas</p><select aria-label="Filtrar obras" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as WorkFilter)} className="max-w-36 rounded border bg-white px-1.5 py-1 text-[10px]"><option value="Todos">Todas</option>{workStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{shownWorks.length === 0 ? <p className="p-3 text-sm text-nexus-muted">Nenhuma obra encontrada para este filtro.</p> : shownWorks.map((work) => { const workBudget = budgets.find((item) => item.id === work.budgetId); return <button key={work.id} onClick={() => setSelectedId(work.id)} className={"mb-1 w-full rounded-lg p-3 text-left " + (selectedId === work.id ? "bg-orange-50" : "hover:bg-slate-50")}><b className="block truncate text-sm">{workBudget?.title || work.contractedServices || "Obra sem título"}</b><span className="block truncate text-xs text-nexus-muted">{clients.find((item) => item.id === work.clientId)?.name}</span><WorkStatusBadge status={work.status} className="mt-1" /></button>; })}</div></aside>
      <section className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-xl border bg-white">{!selected ? <p className="p-12 text-center text-sm text-nexus-muted">Selecione uma obra.</p> : <><div className="flex items-start justify-between border-b p-5"><div><p className="text-xs text-nexus-muted">{selected.number} · {client?.name}</p><h2 className="mt-1 text-xl font-bold">{budget?.title || selected.contractedServices}</h2><p className="mt-1 text-sm text-nexus-muted">{selected.address || "Endereço não informado"}</p></div><WorkStatusBadge status={selected.status} className="px-3 py-1 text-sm" /></div><div className="grid grid-cols-3 gap-3 border-b p-5 text-sm"><div><p className="text-xs text-nexus-muted">Valor contratado</p><b>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selected.contractedValue)}</b></div><div><p className="text-xs text-nexus-muted">Responsável</p><b>{selected.responsible || "Não definido"}</b></div><div><p className="text-xs text-nexus-muted">Previsão de conclusão</p><b>{selected.expectedCompletionDate || "Não definida"}</b></div></div><div className="grid grid-cols-2 gap-5 p-5"><section><h3 className="font-semibold">Status da obra</h3><label className="mt-3 block text-sm">Novo status<select className={input} value={selected.status} onChange={(event) => saveStatus(event.target.value as WorkStatus)}>{workStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="mt-3 block text-sm">Motivo da próxima alteração<input className={input} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Ex.: aguardando entrega do material" /></label><p className="mt-3 text-xs text-nexus-muted">Informe o motivo antes de selecionar o novo status.</p><h3 className="mt-6 font-semibold">Histórico</h3><div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{[...selected.statusHistory].reverse().map((entry) => <div className="rounded-lg bg-slate-50 p-3 text-sm" key={entry.id}><WorkStatusBadge status={entry.status} /><p className="mt-2 text-nexus-muted">{entry.reason}</p><time className="text-xs text-nexus-muted">{new Date(entry.happenedAt).toLocaleString("pt-BR")}</time></div>)}</div></section><section><h3 className="font-semibold">Acompanhamento diário</h3><textarea className={input + " min-h-20"} value={log.activities} onChange={(event) => setLog({ ...log, activities: event.target.value })} placeholder="Atividades realizadas *" /><input className={input} value={log.pendingServices} onChange={(event) => setLog({ ...log, pendingServices: event.target.value })} placeholder="Serviços pendentes" /><input className={input} value={log.problems} onChange={(event) => setLog({ ...log, problems: event.target.value })} placeholder="Problemas encontrados" /><input className={input} value={log.materialsNeeded} onChange={(event) => setLog({ ...log, materialsNeeded: event.target.value })} placeholder="Materiais necessários" /><div className="mt-3 rounded-lg border border-slate-200 p-3"><label className="text-xs font-semibold text-nexus-muted">Profissional cadastrado<select className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" value={professionalId} onChange={(event) => { const value = event.target.value; setProfessionalId(value); const professional = activeProfessionals.find((item) => item.id === value); if (professional) setLog((current) => ({ ...current, professionalsPresent: current.professionalsPresent ? current.professionalsPresent + ", " + professional.name : professional.name })); }}><option value="">Selecionar do cadastro</option>{activeProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label><label className="mt-2 block text-xs font-semibold text-nexus-muted">Profissionais presentes<input className="mt-1 w-full rounded border px-2 py-2 text-sm font-normal text-nexus-ink" value={log.professionalsPresent} onChange={(event) => setLog({ ...log, professionalsPresent: event.target.value })} placeholder="Digite nomes ou escolha acima" /></label></div><textarea className={input + " min-h-16"} value={log.notes} onChange={(event) => setLog({ ...log, notes: event.target.value })} placeholder="Observações da equipe" /><button className="mt-3 rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={saveLog}>Registrar acompanhamento</button><div className="mt-5 max-h-72 space-y-3 overflow-y-auto">{selected.dailyLogs.map((entry) => <article className="rounded-lg border p-3 text-sm" key={entry.id}><b>{new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}</b><p className="mt-1">{entry.activities}</p>{entry.professionalsPresent && <p className="mt-1 text-nexus-muted">Profissionais: {entry.professionalsPresent}</p>}{entry.pendingServices && <p className="mt-1 text-nexus-muted">Pendências: {entry.pendingServices}</p>}{entry.problems && <p className="mt-1 text-nexus-error">Problemas: {entry.problems}</p>}</article>)}</div></section></div></>}</section>
    </div>
    {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">Criar obra</h2><p className="mt-1 text-sm text-nexus-muted">Selecione um orçamento aprovado que ainda não possui obra.</p><select className={input} value={budgetToCreate} onChange={(event) => setBudgetToCreate(event.target.value)}><option value="">Selecione o orçamento</option>{availableBudgets.map((item) => <option key={item.id} value={item.id}>{item.title} · {clients.find((clientItem) => clientItem.id === item.clientId)?.name || "Cliente"}</option>)}</select>{availableBudgets.length === 0 && <p className="mt-3 text-sm text-nexus-muted">Não há orçamentos aprovados disponíveis para criar uma obra.</p>}<div className="mt-6 flex justify-end gap-3"><button onClick={() => { setCreating(false); setBudgetToCreate(""); }}>Cancelar</button><button className="rounded-lg bg-nexus-primary px-4 py-2 text-white disabled:opacity-40" disabled={!budgetToCreate} onClick={() => { const chosen = availableBudgets.find((item) => item.id === budgetToCreate); if (chosen) onCreateWork(chosen); setCreating(false); setBudgetToCreate(""); }}>Criar obra</button></div></section></div>}
  </>;
}

function WorkStatusBadge({ status, className = "" }: { status: WorkStatus; className?: string }) { return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${workStatusTone[status]} ${className}`}>{status}</span>; }
